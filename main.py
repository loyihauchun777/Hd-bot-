import asyncio
import logging
import os
import sqlite3
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    ChatJoinRequest,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is missing")

logging.basicConfig(level=logging.INFO)
bot = Bot(
    BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher(storage=MemoryStorage())

DB = "bot.db"


# ---------------- DATABASE ----------------
def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = db()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS users(
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            joined_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS channels(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            url TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS movies(
            code TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            quality TEXT DEFAULT '',
            url TEXT NOT NULL,
            requests INTEGER DEFAULT 0
        );
        """
    )
    con.commit()
    con.close()


def is_admin(user_id: int) -> bool:
    return user_id == ADMIN_ID


def add_user(message: Message):
    if not message.from_user:
        return
    con = db()
    con.execute(
        """
        INSERT INTO users(user_id, username, first_name)
        VALUES(?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET
            username=excluded.username,
            first_name=excluded.first_name
        """,
        (
            message.from_user.id,
            message.from_user.username,
            message.from_user.first_name,
        ),
    )
    con.commit()
    con.close()


def get_channels():
    con = db()
    rows = con.execute("SELECT * FROM channels ORDER BY id").fetchall()
    con.close()
    return rows


def get_movies(limit=50):
    con = db()
    rows = con.execute(
        "SELECT * FROM movies ORDER BY rowid DESC LIMIT ?", (limit,)
    ).fetchall()
    con.close()
    return rows


# ---------------- KEYBOARDS ----------------
def admin_kb():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎬 Kino boshqarish", callback_data="admin_movies"
                ),
                InlineKeyboardButton(
                    text="📢 Majburiy obuna", callback_data="admin_channels"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="📊 Statistika", callback_data="admin_stats"
                ),
                InlineKeyboardButton(
                    text="👥 Foydalanuvchilar", callback_data="admin_users"
                ),
            ],
        ]
    )


def movies_kb():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="➕ Kino qo‘shish", callback_data="movie_add"
                ),
                InlineKeyboardButton(
                    text="🗑 Kino o‘chirish", callback_data="movie_delete"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="📋 Kinolar ro‘yxati", callback_data="movie_list"
                )
            ],
            [InlineKeyboardButton(text="⬅️ Orqaga", callback_data="admin_home")],
        ]
    )


def channels_kb():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="➕ Kanal qo‘shish", callback_data="channel_add"
                ),
                InlineKeyboardButton(
                    text="🗑 Kanal o‘chirish", callback_data="channel_delete"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="📋 Kanallar ro‘yxati", callback_data="channel_list"
                )
            ],
            [InlineKeyboardButton(text="⬅️ Orqaga", callback_data="admin_home")],
        ]
    )


def subscription_kb():
    buttons = []
    for i, row in enumerate(get_channels(), 1):
        buttons.append(
            [
                InlineKeyboardButton(
                    text=f"📢 {i}. {row['title']}",
                    url=row["url"],
                )
            ]
        )
    buttons.append(
        [
            InlineKeyboardButton(
                text="✅ Obunani tekshirish",
                callback_data="check_sub",
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ---------------- SUBSCRIPTION ----------------
async def subscribed(user_id: int) -> bool:
    rows = get_channels()

    # If no mandatory channels are configured, let the user continue.
    if not rows:
        return True

    me = await bot.get_me()

    for row in rows:
        chat_id = row["chat_id"]

        try:
            member = await bot.get_chat_member(
                chat_id=chat_id,
                user_id=user_id,
            )

            if member.status in {
                ChatMemberStatus.MEMBER,
                ChatMemberStatus.ADMINISTRATOR,
                ChatMemberStatus.CREATOR,
            }:
                continue

            # Restricted users can still be channel members.
            if member.status == ChatMemberStatus.RESTRICTED:
                if getattr(member, "is_member", False):
                    continue

            # A pending join request is not returned as MEMBER by
            # getChatMember. Try to approve it automatically.
            try:
                await bot.approve_chat_join_request(
                    chat_id=chat_id,
                    user_id=user_id,
                )
                await asyncio.sleep(0.4)

                member = await bot.get_chat_member(
                    chat_id=chat_id,
                    user_id=user_id,
                )

                if member.status in {
                    ChatMemberStatus.MEMBER,
                    ChatMemberStatus.ADMINISTRATOR,
                    ChatMemberStatus.CREATOR,
                }:
                    continue

                if (
                    member.status == ChatMemberStatus.RESTRICTED
                    and getattr(member, "is_member", False)
                ):
                    continue

            except Exception:
                # No pending request, or bot lacks permission to approve it.
                logging.info(
                    "No approvable join request for user %s in %s",
                    user_id,
                    chat_id,
                )

            return False

        except Exception:
            logging.exception(
                "Subscription check failed for %s", chat_id
            )
            return False

    return True


async def ask_subscription(message: Message):
    rows = get_channels()
    if not rows:
        await message.answer(
            "⚠️ <b>Majburiy obuna hozircha sozlanmagan.</b>\n\n"
            "Bot administratori kanallarni qo‘shishi kerak."
        )
        return

    await message.answer(
        "🎬 <b>TUNGI KINOLAR HD</b>\n\n"
        "Kinoni olish uchun quyidagi kanallarga obuna bo‘ling.\n\n"
        "1️⃣ Barcha kanallarga obuna bo‘ling.\n"
        "2️⃣ Keyin <b>«✅ Obunani tekshirish»</b> tugmasini bosing.",
        reply_markup=subscription_kb(),
    )


# ---------------- MOVIES ----------------
async def send_movie(message: Message, code: str):
    code = code.strip()

    con = db()
    row = con.execute(
        "SELECT * FROM movies WHERE code=?", (code,)
    ).fetchone()

    if row:
        con.execute(
            "UPDATE movies SET requests=requests+1 WHERE code=?",
            (code,),
        )
        con.commit()

    con.close()

    if not row:
        await message.answer(
            "❌ <b>Bunday kino kodi topilmadi.</b>\n\n"
            "Kodni tekshirib, qaytadan yuboring."
        )
        return

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="▶️ KINONI KO‘RISH",
                    url=row["url"],
                )
            ]
        ]
    )

    await message.answer(
        f"🎬 <b>{row['title']}</b>\n"
        f"🎞 Sifat: <b>{row['quality'] or 'Ko‘rsatilmagan'}</b>\n"
        f"🔢 Kod: <code>{row['code']}</code>\n\n"
        "👇 Kinoni ko‘rish uchun tugmani bosing.",
        reply_markup=keyboard,
    )


# ---------------- FSM STATES ----------------
class AddMovieState(StatesGroup):
    data = State()


class DeleteMovieState(StatesGroup):
    code = State()


class AddChannelState(StatesGroup):
    data = State()


class DeleteChannelState(StatesGroup):
    id = State()


# ---------------- USER COMMANDS ----------------
@dp.message(CommandStart())
async def start(message: Message, state: FSMContext):
    await state.clear()
    add_user(message)

    parts = message.text.split(maxsplit=1)
    arg = parts[1].strip() if len(parts) > 1 else None

    if not await subscribed(message.from_user.id):
        await ask_subscription(message)
        return

    if arg:
        await send_movie(message, arg)
    else:
        await message.answer(
            "✅ <b>Obuna tasdiqlandi!</b>\n\n"
            "🎬 Kino kodini yuboring.\n"
            "Masalan: <code>125</code>"
        )


@dp.message(Command("cancel"))
async def cancel(message: Message, state: FSMContext):
    await state.clear()
    if is_admin(message.from_user.id):
        await message.answer(
            "❌ Amal bekor qilindi.",
            reply_markup=admin_kb(),
        )
    else:
        await message.answer("❌ Amal bekor qilindi.")


# ---------------- ADMIN COMMANDS FIRST ----------------
# These handlers MUST be before the generic F.text handler.
@dp.message(Command("admin"))
async def admin(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    await message.answer(
        "👨‍💻 <b>ADMIN PANEL</b>\n\n"
        "Kerakli bo‘limni tanlang:",
        reply_markup=admin_kb(),
    )


@dp.message(Command("addmovie"))
async def addmovie_command(message: Message):
    if not is_admin(message.from_user.id):
        return

    raw = message.text.partition(" ")[2].strip()
    parts = [x.strip() for x in raw.split("|")]

    if len(parts) != 4:
        await message.answer(
            "❌ Format xato.\n\n"
            "<code>/addmovie kod | nom | sifat | havola</code>"
        )
        return

    code, title, quality, url = parts

    if not code.isdigit():
        await message.answer("❌ Kino kodi faqat raqamlardan iborat bo‘lsin.")
        return

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        await message.answer("❌ Havola http:// yoki https:// bilan boshlansin.")
        return

    con = db()
    old = con.execute(
        "SELECT requests FROM movies WHERE code=?", (code,)
    ).fetchone()

    requests = old["requests"] if old else 0

    con.execute(
        """
        INSERT OR REPLACE INTO movies(code,title,quality,url,requests)
        VALUES(?,?,?,?,?)
        """,
        (code, title, quality, url, requests),
    )
    con.commit()
    con.close()

    await message.answer(
        f"✅ <b>Kino saqlandi!</b>\n\n"
        f"🎬 {title}\n"
        f"🔢 Kod: <code>{code}</code>",
        reply_markup=movies_kb(),
    )


@dp.message(Command("delmovie"))
async def delmovie_command(message: Message):
    if not is_admin(message.from_user.id):
        return

    code = message.text.partition(" ")[2].strip()

    if not code:
        await message.answer("Format: <code>/delmovie 125</code>")
        return

    con = db()
    cur = con.execute("DELETE FROM movies WHERE code=?", (code,))
    con.commit()
    con.close()

    await message.answer(
        "✅ Kino o‘chirildi." if cur.rowcount else "❌ Bunday kod topilmadi.",
        reply_markup=movies_kb(),
    )


@dp.message(Command("addchannel"))
async def addchannel_command(message: Message):
    if not is_admin(message.from_user.id):
        return

    raw = message.text.partition(" ")[2].strip()
    parts = [x.strip() for x in raw.split("|")]

    if len(parts) != 3:
        await message.answer(
            "❌ Format xato.\n\n"
            "<code>/addchannel chat_id | nomi | havola</code>\n\n"
            "Masalan:\n"
            "<code>/addchannel -1001234567890 | Kino 1 | https://t.me/...</code>"
        )
        return

    chat_id, title, url = parts

    if len(get_channels()) >= 8:
        await message.answer("❌ Maksimum 8 ta majburiy kanal mumkin.")
        return

    if not chat_id.lstrip("-").isdigit():
        await message.answer("❌ Chat ID noto‘g‘ri.")
        return

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        await message.answer("❌ Kanal havolasi noto‘g‘ri.")
        return

    # Verify that the bot can access the channel and is an administrator.
    try:
        chat = await bot.get_chat(chat_id)
        bot_member = await bot.get_chat_member(chat_id, (await bot.get_me()).id)

        if bot_member.status not in {
            ChatMemberStatus.ADMINISTRATOR,
            ChatMemberStatus.CREATOR,
        }:
            await message.answer(
                "❌ Bot bu kanalda administrator emas.\n\n"
                "Avval botni kanalga admin qiling."
            )
            return

        # If title is empty, use Telegram's channel title.
        if not title:
            title = chat.title or "Kanal"

    except Exception:
        logging.exception("Channel validation failed")
        await message.answer(
            "❌ Kanalni tekshirib bo‘lmadi.\n\n"
            "Tekshiring:\n"
            "• Chat ID to‘g‘ri\n"
            "• Bot kanalga admin\n"
            "• Kanal hali mavjud"
        )
        return

    con = db()
    try:
        con.execute(
            "INSERT INTO channels(chat_id,title,url) VALUES(?,?,?)",
            (chat_id, title, url),
        )
        con.commit()
    except sqlite3.IntegrityError:
        con.close()
        await message.answer("⚠️ Bu kanal allaqachon qo‘shilgan.")
        return

    con.close()

    await message.answer(
        f"✅ <b>Kanal qo‘shildi!</b>\n\n"
        f"📢 {title}\n"
        f"🆔 <code>{chat_id}</code>",
        reply_markup=channels_kb(),
    )


@dp.message(Command("delchannel"))
async def delchannel_command(message: Message):
    if not is_admin(message.from_user.id):
        return

    raw = message.text.partition(" ")[2].strip()

    if not raw.isdigit():
        await message.answer("Format: <code>/delchannel 1</code>")
        return

    con = db()
    cur = con.execute("DELETE FROM channels WHERE id=?", (int(raw),))
    con.commit()
    con.close()

    await message.answer(
        "✅ Kanal o‘chirildi." if cur.rowcount else "❌ Kanal ID topilmadi.",
        reply_markup=channels_kb(),
    )


@dp.message(Command("movie"))
async def movie_info(message: Message):
    if not is_admin(message.from_user.id):
        return

    code = message.text.partition(" ")[2].strip()
    con = db()
    row = con.execute(
        "SELECT * FROM movies WHERE code=?", (code,)
    ).fetchone()
    con.close()

    if not row:
        await message.answer("❌ Kino topilmadi.")
        return

    await message.answer(
        f"🎬 <b>{row['title']}</b>\n"
        f"🔢 Kod: <code>{row['code']}</code>\n"
        f"🎞 Sifat: {row['quality']}\n"
        f"🔎 So‘rovlar: {row['requests']}\n"
        f"🔗 {row['url']}"
    )


# ---------------- ADMIN CALLBACKS ----------------
@dp.callback_query(F.data == "admin_home")
async def admin_home(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    await state.clear()
    await call.message.edit_text(
        "👨‍💻 <b>ADMIN PANEL</b>\n\n"
        "Kerakli bo‘limni tanlang:",
        reply_markup=admin_kb(),
    )
    await call.answer()


@dp.callback_query(F.data == "admin_movies")
async def admin_movies(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    await state.clear()
    await call.message.edit_text(
        "🎬 <b>KINO BOSHQARISH</b>\n\n"
        "Bu yerdan kinolarni tugmalar orqali qo‘shish yoki o‘chirish mumkin.",
        reply_markup=movies_kb(),
    )
    await call.answer()


@dp.callback_query(F.data == "admin_channels")
async def admin_channels(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    await state.clear()
    rows = get_channels()

    text = "📢 <b>MAJBURIY OBUNA</b>\n\n"

    if not rows:
        text += "Hozircha kanal qo‘shilmagan.\n"
    else:
        for i, r in enumerate(rows, 1):
            text += (
                f"{i}. <b>{r['title']}</b>\n"
                f"   🆔 <code>{r['chat_id']}</code>\n\n"
            )

    text += "Maksimum: <b>8 ta kanal</b>."

    await call.message.edit_text(text, reply_markup=channels_kb())
    await call.answer()


@dp.callback_query(F.data == "admin_stats")
async def admin_stats(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    con = db()
    users = con.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    movies = con.execute("SELECT COUNT(*) c FROM movies").fetchone()["c"]
    requests = con.execute(
        "SELECT COALESCE(SUM(requests),0) c FROM movies"
    ).fetchone()["c"]
    channels_count = con.execute(
        "SELECT COUNT(*) c FROM channels"
    ).fetchone()["c"]
    con.close()

    await call.message.edit_text(
        "📊 <b>STATISTIKA</b>\n\n"
        f"👥 Foydalanuvchilar: <b>{users}</b>\n"
        f"🎬 Kinolar: <b>{movies}</b>\n"
        f"🔎 Kino so‘rovlari: <b>{requests}</b>\n"
        f"📢 Majburiy kanallar: <b>{channels_count}/8</b>",
        reply_markup=admin_kb(),
    )
    await call.answer()


@dp.callback_query(F.data == "admin_users")
async def admin_users(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    con = db()
    rows = con.execute(
        "SELECT user_id, username, first_name, joined_at "
        "FROM users ORDER BY joined_at DESC LIMIT 15"
    ).fetchall()
    total = con.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    con.close()

    text = f"👥 <b>FOYDALANUVCHILAR: {total}</b>\n\n"

    if rows:
        for r in rows:
            name = r["first_name"] or "Noma'lum"
            username = f"@{r['username']}" if r["username"] else "username yo‘q"
            text += f"• {name} — {username}\n"
    else:
        text += "Hozircha foydalanuvchi yo‘q."

    await call.message.edit_text(text, reply_markup=admin_kb())
    await call.answer()


@dp.callback_query(F.data == "movie_add")
async def movie_add(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    await state.set_state(AddMovieState.data)
    await call.message.answer(
        "➕ <b>KINO QO‘SHISH</b>\n\n"
        "Quyidagi formatda bitta xabar yuboring:\n\n"
        "<code>kod | kino nomi | sifat | havola</code>\n\n"
        "Masalan:\n"
        "<code>125 | Avatar 2 | HD 1080p | https://example.com/movie</code>\n\n"
        "Bekor qilish: /cancel"
    )
    await call.answer()


@dp.callback_query(F.data == "movie_delete")
async def movie_delete(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    await state.set_state(DeleteMovieState.code)
    await call.message.answer(
        "🗑 O‘chiriladigan kino kodini yuboring.\n\n"
        "Masalan: <code>125</code>\n\n"
        "Bekor qilish: /cancel"
    )
    await call.answer()


@dp.callback_query(F.data == "movie_list")
async def movie_list(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    rows = get_movies(50)
    if not rows:
        text = "📋 <b>KINOLAR RO‘YXATI</b>\n\nHozircha kino yo‘q."
    else:
        text = "📋 <b>KINOLAR RO‘YXATI</b>\n\n"
        for r in rows:
            text += (
                f"🎬 <b>{r['title']}</b>\n"
                f"🔢 <code>{r['code']}</code> • {r['quality'] or '-'}\n\n"
            )

    await call.message.edit_text(text, reply_markup=movies_kb())
    await call.answer()


@dp.callback_query(F.data == "channel_add")
async def channel_add(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    if len(get_channels()) >= 8:
        await call.answer("❌ 8 ta kanal limiti to‘lgan.", show_alert=True)
        return

    await state.set_state(AddChannelState.data)
    await call.message.answer(
        "➕ <b>KANAL QO‘SHISH</b>\n\n"
        "Avval botni kanalga administrator qiling.\n\n"
        "Keyin quyidagi formatda yuboring:\n\n"
        "<code>chat_id | kanal nomi | kanal havolasi</code>\n\n"
        "Masalan:\n"
        "<code>-1001234567890 | Tungi Kinolar | https://t.me/+...</code>\n\n"
        "Bekor qilish: /cancel"
    )
    await call.answer()


@dp.callback_query(F.data == "channel_delete")
async def channel_delete(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    rows = get_channels()
    if not rows:
        await call.answer("Hozircha kanal yo‘q.", show_alert=True)
        return

    text = "🗑 <b>KANAL O‘CHIRISH</b>\n\n"
    for r in rows:
        text += f"{r['id']} — {r['title']}\n"

    text += "\nO‘chiriladigan kanalning ID raqamini yuboring."

    await state.set_state(DeleteChannelState.id)
    await call.message.answer(text)
    await call.answer()


@dp.callback_query(F.data == "channel_list")
async def channel_list(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer()
        return

    rows = get_channels()
    text = "📋 <b>MAJBURIY KANALLAR</b>\n\n"

    if not rows:
        text += "Hozircha kanal yo‘q."
    else:
        for r in rows:
            text += (
                f"🆔 <b>{r['id']}</b> — {r['title']}\n"
                f"ID: <code>{r['chat_id']}</code>\n\n"
            )

    await call.message.edit_text(text, reply_markup=channels_kb())
    await call.answer()


# ---------------- ADMIN FSM INPUTS ----------------
@dp.message(AddMovieState.data, F.text)
async def add_movie_state(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    parts = [x.strip() for x in message.text.split("|")]

    if len(parts) != 4:
        await message.answer(
            "❌ Format xato.\n\n"
            "<code>kod | nom | sifat | havola</code>"
        )
        return

    code, title, quality, url = parts

    if not code.isdigit():
        await message.answer("❌ Kod faqat raqam bo‘lsin.")
        return

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        await message.answer("❌ Havola noto‘g‘ri.")
        return

    con = db()
    old = con.execute(
        "SELECT requests FROM movies WHERE code=?", (code,)
    ).fetchone()
    requests = old["requests"] if old else 0

    con.execute(
        "INSERT OR REPLACE INTO movies(code,title,quality,url,requests)"
        " VALUES(?,?,?,?,?)",
        (code, title, quality, url, requests),
    )
    con.commit()
    con.close()

    await state.clear()
    await message.answer(
        f"✅ <b>Kino qo‘shildi!</b>\n\n"
        f"🎬 {title}\n"
        f"🔢 Kod: <code>{code}</code>\n"
        f"🎞 Sifat: {quality}",
        reply_markup=movies_kb(),
    )


@dp.message(DeleteMovieState.code, F.text)
async def delete_movie_state(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    code = message.text.strip()

    con = db()
    cur = con.execute("DELETE FROM movies WHERE code=?", (code,))
    con.commit()
    con.close()

    await state.clear()
    await message.answer(
        "✅ Kino o‘chirildi." if cur.rowcount else "❌ Kod topilmadi.",
        reply_markup=movies_kb(),
    )


@dp.message(AddChannelState.data, F.text)
async def add_channel_state(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    parts = [x.strip() for x in message.text.split("|")]

    if len(parts) != 3:
        await message.answer(
            "❌ Format xato.\n\n"
            "<code>chat_id | kanal nomi | havola</code>"
        )
        return

    chat_id, title, url = parts

    if len(get_channels()) >= 8:
        await state.clear()
        await message.answer("❌ Maksimum 8 ta kanal.")
        return

    if not chat_id.lstrip("-").isdigit():
        await message.answer("❌ Chat ID noto‘g‘ri.")
        return

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        await message.answer("❌ Havola http:// yoki https:// bo‘lsin.")
        return

    try:
        chat = await bot.get_chat(chat_id)
        me = await bot.get_me()
        bot_member = await bot.get_chat_member(chat_id, me.id)

        if bot_member.status not in {
            ChatMemberStatus.ADMINISTRATOR,
            ChatMemberStatus.CREATOR,
        }:
            await message.answer(
                "❌ Bot bu kanalda administrator emas.\n"
                "Avval botni kanalga admin qiling."
            )
            return

        if not title:
            title = chat.title or "Kanal"

    except Exception:
        logging.exception("Could not validate channel")
        await message.answer(
            "❌ Kanalni tekshirishda xatolik.\n\n"
            "Chat ID, bot adminligi va kanal mavjudligini tekshiring."
        )
        return

    con = db()
    try:
        con.execute(
            "INSERT INTO channels(chat_id,title,url) VALUES(?,?,?)",
            (chat_id, title, url),
        )
        con.commit()
    except sqlite3.IntegrityError:
        con.close()
        await state.clear()
        await message.answer(
            "⚠️ Bu kanal allaqachon qo‘shilgan.",
            reply_markup=channels_kb(),
        )
        return

    con.close()
    await state.clear()

    await message.answer(
        f"✅ <b>Kanal qo‘shildi!</b>\n\n"
        f"📢 {title}\n"
        f"🆔 <code>{chat_id}</code>\n\n"
        "Endi foydalanuvchilardan ushbu kanalga obuna bo‘lish talab qilinadi.",
        reply_markup=channels_kb(),
    )


@dp.message(DeleteChannelState.id, F.text)
async def delete_channel_state(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if not message.text.strip().isdigit():
        await message.answer("❌ ID faqat raqam bo‘lsin.")
        return

    con = db()
    cur = con.execute(
        "DELETE FROM channels WHERE id=?", (int(message.text.strip()),)
    )
    con.commit()
    con.close()

    await state.clear()
    await message.answer(
        "✅ Kanal o‘chirildi." if cur.rowcount else "❌ Kanal ID topilmadi.",
        reply_markup=channels_kb(),
    )


# ---------------- JOIN REQUESTS ----------------
@dp.chat_join_request()
async def handle_join_request(request: ChatJoinRequest):
    """
    Private channels with join requests:
    when a user sends a join request, automatically approve it so the
    user becomes a real member and Telegram's getChatMember check succeeds.
    """
    try:
        await bot.approve_chat_join_request(
            chat_id=request.chat.id,
            user_id=request.from_user.id,
        )
        logging.info(
            "Approved join request: user=%s chat=%s",
            request.from_user.id,
            request.chat.id,
        )
    except Exception:
        logging.exception(
            "Could not approve join request: user=%s chat=%s",
            request.from_user.id,
            request.chat.id,
        )


# ---------------- SUBSCRIPTION CALLBACK ----------------
@dp.callback_query(F.data == "check_sub")
async def check_sub(call: CallbackQuery):
    if await subscribed(call.from_user.id):
        await call.answer("✅ Obuna tasdiqlandi!")
        try:
            await call.message.edit_text(
                "✅ <b>Obuna tasdiqlandi!</b>\n\n"
                "🎬 Kino kodini yuboring.\n"
                "Masalan: <code>125</code>"
            )
        except Exception:
            pass
    else:
        await call.answer(
            "❌ Hali barcha kanallarga obuna bo‘lmagansiz.",
            show_alert=True,
        )


# ---------------- GENERIC USER TEXT LAST ----------------
@dp.message(F.text)
async def text_handler(message: Message):
    add_user(message)

    if is_admin(message.from_user.id):
        await message.answer(
            "⚠️ Buyruqni tanimadim.\n\n"
            "👨‍💻 Admin panel uchun /admin ni bosing."
        )
        return

    if not await subscribed(message.from_user.id):
        await ask_subscription(message)
        return

    text = message.text.strip()

    if text.isdigit():
        await send_movie(message, text)
    else:
        await message.answer(
            "⚠️ <b>Kino kodini raqam ko‘rinishida yuboring.</b>\n\n"
            "Masalan: <code>125</code>"
        )


# ---------------- STARTUP ----------------
async def main():
    init_db()
    me = await bot.get_me()
    logging.info("Bot started: @%s", me.username)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

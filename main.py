import asyncio
import logging
import os
import sqlite3
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.enums import ChatMemberStatus, ParseMode

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is missing")

logging.basicConfig(level=logging.INFO)
bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

DB = "bot.db"

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS users(
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS channels(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS movies(
        code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        quality TEXT,
        url TEXT NOT NULL,
        requests INTEGER DEFAULT 0
    );
    """)
    con.commit()
    con.close()

def is_admin(user_id):
    return user_id == ADMIN_ID

def add_user(message: Message):
    con = db()
    con.execute(
        "INSERT OR REPLACE INTO users(user_id,username,first_name) VALUES(?,?,?)",
        (message.from_user.id, message.from_user.username, message.from_user.first_name)
    )
    con.commit()
    con.close()

def channels():
    con = db()
    rows = con.execute("SELECT * FROM channels ORDER BY id").fetchall()
    con.close()
    return rows

def admin_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎬 Kino boshqarish", callback_data="admin_movies"),
         InlineKeyboardButton(text="📢 Majburiy obuna", callback_data="admin_channels")],
        [InlineKeyboardButton(text="📊 Statistika", callback_data="admin_stats"),
         InlineKeyboardButton(text="👥 Foydalanuvchilar", callback_data="admin_users")]
    ])

def subscription_kb():
    rows = channels()
    buttons = []
    for i, row in enumerate(rows, 1):
        buttons.append([InlineKeyboardButton(text=f"📢 {i}. {row['title']}", url=row["url"])])
    buttons.append([InlineKeyboardButton(text="✅ Obunani tekshirish", callback_data="check_sub")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

async def subscribed(user_id: int):
    for row in channels():
        try:
            member = await bot.get_chat_member(row["chat_id"], user_id)
            if member.status in {
                ChatMemberStatus.LEFT,
                ChatMemberStatus.KICKED,
            }:
                return False
        except Exception:
            return False
    return True

async def ask_subscription(message: Message):
    rows = channels()
    if not rows:
        await message.answer("⚠️ Hozircha majburiy obuna kanallari sozlanmagan.\n\nAdmin kanallarni qo‘shishi kerak.")
        return
    await message.answer(
        "🎬 <b>KINO BOT</b>\n\n"
        "Kinoni olish uchun quyidagi kanallarga obuna bo‘ling.\n"
        "Barcha kanallarga obuna bo‘lgach, <b>«✅ Obunani tekshirish»</b> tugmasini bosing.",
        reply_markup=subscription_kb()
    )

@dp.message(CommandStart())
async def start(message: Message):
    add_user(message)
    arg = message.text.split(maxsplit=1)[1] if len(message.text.split()) > 1 else None
    if not await subscribed(message.from_user.id):
        await ask_subscription(message)
        return
    if arg:
        await send_movie(message, arg)
    else:
        await message.answer("✅ Obuna tasdiqlandi!\n\n🎬 Kino kodini yuboring.\nMasalan: <code>125</code>")

@dp.callback_query(F.data == "check_sub")
async def check_sub(call: CallbackQuery):
    if await subscribed(call.from_user.id):
        await call.message.edit_text(
            "✅ <b>Obuna tasdiqlandi!</b>\n\n"
            "🎬 Endi kino kodini yuboring.\n"
            "Masalan: <code>125</code>"
        )
    else:
        await call.answer("❌ Hali barcha kanallarga obuna bo‘lmagansiz.", show_alert=True)
        return
    await call.answer()

async def send_movie(message: Message, code: str):
    con = db()
    row = con.execute("SELECT * FROM movies WHERE code=?", (code,)).fetchone()
    if row:
        con.execute("UPDATE movies SET requests=requests+1 WHERE code=?", (code,))
        con.commit()
    con.close()
    if not row:
        await message.answer("❌ Bunday kino kodi topilmadi.\n\nKodni tekshirib, qaytadan yuboring.")
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="▶️ KINONI KO‘RISH", url=row["url"])]
    ])
    await message.answer(
        f"🎬 <b>{row['title']}</b>\n"
        f"🎞 Sifat: {row['quality'] or 'Ko‘rsatilmagan'}\n"
        f"🔢 Kod: <code>{row['code']}</code>\n\n"
        "👇 Kinoni ko‘rish uchun tugmani bosing.",
        reply_markup=kb
    )

@dp.message(Command("admin"))
async def admin(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer(
        "👨‍💻 <b>ADMIN PANEL</b>\n\nKerakli bo‘limni tanlang:",
        reply_markup=admin_kb()
    )

@dp.message(F.text)
async def text_handler(message: Message):
    add_user(message)
    if not await subscribed(message.from_user.id):
        await ask_subscription(message)
        return
    text = message.text.strip()
    if text.isdigit():
        await send_movie(message, text)
    else:
        await message.answer("⚠️ Kino kodini raqam ko‘rinishida yuboring.\nMasalan: <code>125</code>")

@dp.callback_query(F.data == "admin_stats")
async def admin_stats(call: CallbackQuery):
    if not is_admin(call.from_user.id): return
    con = db()
    users = con.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    movies = con.execute("SELECT COUNT(*) c FROM movies").fetchone()["c"]
    req = con.execute("SELECT COALESCE(SUM(requests),0) c FROM movies").fetchone()["c"]
    ch = con.execute("SELECT COUNT(*) c FROM channels").fetchone()["c"]
    con.close()
    await call.message.edit_text(
        f"📊 <b>STATISTIKA</b>\n\n👥 Foydalanuvchilar: {users}\n"
        f"🎬 Kinolar: {movies}\n🔎 Kino so‘rovlari: {req}\n📢 Majburiy obuna kanallari: {ch}",
        reply_markup=admin_kb()
    )

@dp.callback_query(F.data == "admin_users")
async def admin_users(call: CallbackQuery):
    if not is_admin(call.from_user.id): return
    con = db()
    users = con.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    con.close()
    await call.message.edit_text(f"👥 Jami foydalanuvchilar: <b>{users}</b>", reply_markup=admin_kb())

@dp.callback_query(F.data == "admin_movies")
async def admin_movies(call: CallbackQuery):
    if not is_admin(call.from_user.id): return
    await call.message.edit_text(
        "🎬 <b>KINO BOSHQARISH</b>\n\n"
        "Hozirgi birinchi versiyada kinolarni SQLite bazasiga qo‘shish uchun admin buyruqlaridan foydalaning:\n\n"
        "<code>/addmovie kod | nom | sifat | havola</code>\n"
        "<code>/delmovie kod</code>\n"
        "<code>/movie kod</code>",
        reply_markup=admin_kb()
    )

@dp.callback_query(F.data == "admin_channels")
async def admin_channels(call: CallbackQuery):
    if not is_admin(call.from_user.id): return
    rows = channels()
    text = "📢 <b>MAJBURIY OBUNA</b>\n\n"
    if not rows:
        text += "Hozircha kanal yo‘q.\n"
    else:
        for i, r in enumerate(rows, 1):
            text += f"{i}. {r['title']} — <code>{r['chat_id']}</code>\n"
    text += "\nBuyruqlar:\n<code>/addchannel chat_id | nomi | havola</code>\n<code>/delchannel ID</code>"
    await call.message.edit_text(text, reply_markup=admin_kb())

@dp.message(Command("addmovie"))
async def addmovie(message: Message):
    if not is_admin(message.from_user.id): return
    raw = message.text.partition(" ")[2]
    parts = [x.strip() for x in raw.split("|")]
    if len(parts) != 4:
        await message.answer("Format:\n<code>/addmovie kod | nom | sifat | havola</code>")
        return
    code, title, quality, url = parts
    if not urlparse(url).scheme:
        await message.answer("❌ Havola noto‘g‘ri.")
        return
    con = db()
    con.execute("INSERT OR REPLACE INTO movies(code,title,quality,url,requests) VALUES(?,?,?,?,COALESCE((SELECT requests FROM movies WHERE code=?),0))",
                (code,title,quality,url,code))
    con.commit(); con.close()
    await message.answer(f"✅ Kino qo‘shildi: <b>{title}</b> — kod <code>{code}</code>")

@dp.message(Command("delmovie"))
async def delmovie(message: Message):
    if not is_admin(message.from_user.id): return
    code = message.text.partition(" ")[2].strip()
    con = db(); cur = con.execute("DELETE FROM movies WHERE code=?", (code,))
    con.commit(); con.close()
    await message.answer("✅ O‘chirildi." if cur.rowcount else "❌ Kod topilmadi.")

@dp.message(Command("movie"))
async def movie_info(message: Message):
    if not is_admin(message.from_user.id): return
    code = message.text.partition(" ")[2].strip()
    con = db(); row = con.execute("SELECT * FROM movies WHERE code=?", (code,)).fetchone(); con.close()
    if not row:
        await message.answer("❌ Topilmadi."); return
    await message.answer(f"🎬 {row['title']}\n🔢 {row['code']}\n🎞 {row['quality']}\n🔎 So‘rovlar: {row['requests']}\n🔗 {row['url']}")

@dp.message(Command("addchannel"))
async def addchannel(message: Message):
    if not is_admin(message.from_user.id): return
    raw = message.text.partition(" ")[2]
    parts = [x.strip() for x in raw.split("|")]
    if len(parts) != 3:
        await message.answer("Format:\n<code>/addchannel chat_id | nomi | havola</code>")
        return
    chat_id, title, url = parts
    if len(channels()) >= 8:
        await message.answer("❌ Maksimum 8 ta kanal.")
        return
    con = db(); con.execute("INSERT INTO channels(chat_id,title,url) VALUES(?,?,?)",(chat_id,title,url)); con.commit(); con.close()
    await message.answer(f"✅ Kanal qo‘shildi: <b>{title}</b>")

@dp.message(Command("delchannel"))
async def delchannel(message: Message):
    if not is_admin(message.from_user.id): return
    try: cid = int(message.text.partition(" ")[2].strip())
    except: 
        await message.answer("Format: <code>/delchannel ID</code>"); return
    con = db(); cur = con.execute("DELETE FROM channels WHERE id=?", (cid,)); con.commit(); con.close()
    await message.answer("✅ Kanal o‘chirildi." if cur.rowcount else "❌ ID topilmadi.")

async def main():
    init_db()
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())

// Static game data: texts, voice lines, ranks, shop items.

export const VIOLATIONS = {
  // seen on the road (reason to stop the car)
  tezlik:    { name: 'Tezlikni oshirish', minor: false, road: true, icon: '⚡' },
  kamar:     { name: 'Xavfsizlik kamarini taqmaslik', minor: true, road: true, icon: '🔓' },
  telefon:   { name: 'Rul ortida telefonda gaplashish', minor: false, road: true, icon: '📱' },
  qizil:     { name: 'Svetoforning qizil chirog‘iga o‘tish', minor: false, road: true, icon: '🚦' },
  tonirovka: { name: 'Oynalarni ruxsatsiz qoraytirish', minor: true, road: true, icon: '🕶️' },
  raqamsiz:  { name: 'Davlat raqami belgisi yo‘q', minor: false, road: true, icon: '🚫' },
  // found only during the check
  guvohnoma: { name: 'Haydovchilik guvohnomasi muddati o‘tgan', minor: false },
  rasm:      { name: 'Guvohnomadagi rasm boshqa odamniki', minor: false },
  sugurta:   { name: 'Sug‘urta polisi muddati o‘tgan', minor: true },
  texraqam:  { name: 'Texpasportdagi raqam mashinaga mos emas', minor: false },
  mast:      { name: 'Mast holda transport boshqarish', minor: false },
  fara:      { name: 'Fara nosoz', minor: true },
  shina:     { name: 'Shina yeyilgan', minor: true },
  pora:      { name: 'Pora taklif qilish', minor: false },
};

export const FIRST_NAMES = ['Aziz', 'Jasur', 'Bekzod', 'Sardor', 'Otabek', 'Shoxrux', 'Doniyor', 'Rustam',
  'Ulug‘bek', 'Akmal', 'Farrux', 'Javlon', 'Nodir', 'Sherzod', 'Islom', 'Botir', 'Anvar', 'Dilshod', 'Murod', 'Laziz'];
export const LAST_NAMES = ['Karimov', 'Toshmatov', 'Rahimov', 'Yusupov', 'Nazarov', 'Aliyev', 'Ismoilov', 'Qodirov',
  'Ergashev', 'Saidov', 'Xolmatov', 'Abdullayev', 'Mirzayev', 'Sobirov', 'Normatov', 'Usmonov'];

export const CAR_TYPES = [
  { id: 'sedan', name: 'Sedan', w: 1.8, l: 4.4, h: 1.45 },
  { id: 'hatch', name: 'Hetchbek', w: 1.7, l: 3.7, h: 1.5 },
  { id: 'van', name: 'Mikroavtobus', w: 1.7, l: 3.9, h: 1.95 },
  { id: 'suv', name: 'Krossover', w: 1.9, l: 4.5, h: 1.7 },
];

export const CAR_COLORS = [
  ['oq', 0xf2f2f2], ['oq', 0xf5f5f0], ['oq', 0xeeeeee], ['kumush', 0xb8bec6], ['qora', 0x1d1f24],
  ['kulrang', 0x6c737d], ['to‘q ko‘k', 0x23407a], ['qizil', 0xb3242b], ['jigarrang', 0x6b4a2f], ['yashil', 0x2f6b4a],
];

// Voice lines. Files: audio/<voice>/<id>.mp3. Missing files are skipped silently.
export const INSPECTOR_LINES = {
  I1: 'Assalomu alaykum! Yo‘l patrul xizmati inspektori. Hujjatlaringizni ko‘rsating.',
  I2: 'Haydovchilik guvohnomangiz va texnik pasportingizni bering.',
  I3: 'Siz tezlikni oshirdingiz.',
  I4: 'Siz xavfsizlik kamarini taqmagansiz.',
  I5: 'Rul ortida telefonda gaplashish mumkin emas.',
  I6: 'Siz svetoforning qizil chirog‘iga o‘tdingiz.',
  I7: 'Mashinangiz oynalari ruxsatsiz qoraytirilgan.',
  I8: 'Alkotesterga puflang, iltimos.',
  I9: 'Mashinangizni ko‘zdan kechiraman.',
  I10: 'Pora taklif qilish jinoyat. Bu holat qayd etildi.',
  I11: 'Sizga jarima yoziladi.',
  I12: 'Bu safar ogohlantirish bilan cheklanaman. Ehtiyot bo‘ling.',
  I13: 'Siz mast holatdasiz. Transport vositasini boshqarishdan chetlatilasiz.',
  I14: 'Hammasi joyida. Yo‘lingiz bexatar bo‘lsin!',
  I16: 'Mashinangizda davlat raqami belgisi yo‘q.',
};

export const DRIVER_LINES = {
  D1: 'Va alaykum assalom, inspektor aka.',
  D2: 'Mana, marhamat, hujjatlarim.',
  D3: 'Kechirasiz, shoshayotgan edim.',
  D4: 'Men tezlikni oshirmadim-ku!',
  D5: 'Kamarni hozirgina yechgan edim.',
  D6: 'Muhim qo‘ng‘iroq edi, kechirasiz.',
  D7: 'Sariq chiroq edi-ku, aka!',
  D8: 'Inspektor aka, balki o‘zimizcha kelishib olarmiz?',
  D9: 'Yaxshi, tushundim. Boshqa takrorlanmaydi.',
  D10: 'Mayli, puflayman.',
  D11: 'Men ichmaganman, faqat kefir ichgandim!',
  D12: 'Rahmat, inspektor aka. Xayr!',
  D13: 'Raqamni ertaga albatta joyiga qo‘yaman.',
  D14: 'Bu mashina akamniki, ishonchnomam bor.',
  D15: 'Oynalarni ertaga albatta tozalataman.',
};

export const VOICES = {
  inspector: 'inspector',
  drivers: ['d1', 'd2', 'd3'],
};

export const RANKS = [
  { id: 0, name: 'Serjant', xp: 0, rep: 0, quota: 4, stars: '★' },
  { id: 1, name: 'Leytenant', xp: 1500, rep: 60, quota: 6, stars: '★★' },
  { id: 2, name: 'Kapitan', xp: 4000, rep: 70, quota: 8, stars: '★★★' },
];

export const SHOP = {
  uniform: [
    { id: 'yozgi', name: 'Yozgi forma', price: 0, rank: 0, shirt: 0x8fb4d9, pants: 0x2b3a55, vest: true },
    { id: 'qishki', name: 'Qishki forma', price: 800, rank: 0, shirt: 0x2b3a55, pants: 0x1e283b, vest: true, coat: true },
    { id: 'parad', name: 'Parad formasi', price: 2000, rank: 1, shirt: 0xf2f2f2, pants: 0x1e283b, vest: false },
  ],
  car: [
    { id: 'sedan', name: 'Patrul sedani', price: 0, rank: 0, type: 'sedan' },
    { id: 'suv', name: 'Patrul krossoveri', price: 1500, rank: 0, type: 'suv' },
    { id: 'van', name: 'Patrul mikroavtobusi', price: 3000, rank: 2, type: 'van' },
  ],
};

export const SHIFT_SECONDS = 300;
export const SPEED_LIMIT = 60;

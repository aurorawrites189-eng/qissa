/**
 * Seed stories for Qissa — 100% original sample content written for this
 * project. Used by scripts/seed.mjs to populate a fresh Supabase project
 * with demo posts.
 *
 * Conventions:
 * - `category` is a slug that must exist in supabase/seed.sql.
 * - `content` is plain text; paragraphs separated by blank lines (the
 *   reader page splits on /\n{2,}/). For poetry, single \n = line break,
 *   blank line = stanza break.
 * - `isKids` marks stories eligible for the Kids' Story World; the seed
 *   script publishes those with is_kids_approved = true.
 */

export interface SeedStory {
  /** Display title (in the story's own language). */
  title: string;
  /** 'ur' | 'en' — must match the posts.language column. */
  language: "ur" | "en";
  /** Category slug from supabase/seed.sql. */
  category: string;
  /** Full body text, paragraphs separated by blank lines. */
  content: string;
  /** Free-form tags. */
  tags: string[];
  /** True for kids' stories (published with is_kids_approved = true). */
  isKids: boolean;
}

function paragraphs(...ps: string[]): string {
  return ps.join("\n\n");
}

export const SEED_STORIES: SeedStory[] = [
  // ------------------------------------------------------------------
  // 1. Kids — Urdu moral story (~300 words)
  // ------------------------------------------------------------------
  {
    title: "امانت کا پھل",
    language: "ur",
    category: "moral-stories",
    tags: ["دیانتداری", "اخلاقی کہانی", "بچوں کی کہانی"],
    isKids: true,
    content: paragraphs(
      "پرانے شہر کی ایک تنگ گلی میں بارہ سال کا لڑکا بلال اپنی والدہ کے ساتھ رہتا تھا۔ اس کے والد کا انتقال ہو چکا تھا، اس لیے بلال اسکول کے بعد محلے کی ایک دکان پر کام کر کے گھر کا خرچ چلاتا تھا۔ وہ محنتی ہونے کے ساتھ ساتھ بہت دیانتدار بھی تھا، اور محلے کے سب لوگ اس کی تعریف کرتے تھے۔",
      "ایک شام جب وہ دکان سے گھر واپس آ رہا تھا تو اسے راستے میں ایک چمڑے کا بٹوا پڑا نظر آیا۔ بلال نے بٹوا اٹھایا اور کھولا تو حیران رہ گیا — اس میں کئی نوٹ اور ایک بوڑھے شخص کی چھوٹی سی تصویر تھی۔ اتنے پیسے بلال نے کبھی ایک ساتھ نہیں دیکھے تھے۔ اس کے دل میں خیال آیا کہ ان پیسوں سے وہ اپنی بیمار ماں کے لیے دوا خرید سکتا ہے، جو کئی دن سے بستر پر تھیں۔",
      "مگر اگلے ہی لمحے اسے اپنے مرحوم والد کی نصیحت یاد آئی: بیٹا، کسی کی امانت میں کبھی خیانت نہ کرنا، روزی حلال میں ہی برکت ہوتی ہے۔ بلال نے گہری سانس لی، بٹوا بند کیا اور آس پاس کے دکانداروں سے پوچھنا شروع کیا کہ یہ بٹوا کس کا ہے۔",
      "تھوڑی دور ایک بوڑھا شخص پریشان کھڑا ادھر ادھر دیکھ رہا تھا۔ بلال نے قریب جا کر پوچھا تو معلوم ہوا کہ بٹوا اسی کا تھا۔ بوڑھے شخص کی آنکھوں میں خوشی کے آنسو آ گئے۔ وہ ایک ریٹائرڈ استاد تھے اور یہ رقم ان کی ماہانہ پنشن تھی، جس سے پورے مہینے کا خرچ چلنا تھا۔",
      "استاد نے شکر گزاری سے بلال کو کچھ نوٹ انعام میں دینے چاہے، مگر بلال نے نرمی سے انکار کر دیا۔ یہ میرا فرض تھا، انعام کیسا؟ اس نے مسکرا کر کہا۔ استاد نے اس کی پیشانی چومی اور دل سے دعا دی۔",
      "اگلے دن استاد بلال کے اسکول گئے، پرنسپل سے ملے اور بلال کی پوری سال کی فیس معاف کروا دی۔ انہوں نے بلال کے لیے ایک چھوٹا سا ماہانہ وظیفہ بھی مقرر کر دیا تاکہ وہ دکان کے بجائے پڑھائی پر توجہ دے سکے۔ بلال کی دیانتداری اس کے لیے برکت بن گئی۔",
      "سبق: دیانتداری کبھی رائیگاں نہیں جاتی۔ جو دوسروں کی امانت کی حفاظت کرتا ہے، اللہ اس کی حفاظت کرتا ہے۔"
    ),
  },

  // ------------------------------------------------------------------
  // 2. Kids — Urdu animal story (~300 words)
  // ------------------------------------------------------------------
  {
    title: "ننھا ہاتھی اور چڑیا",
    language: "ur",
    category: "animal-stories",
    tags: ["دوستی", "جانور", "بچوں کی کہانی"],
    isKids: true,
    content: paragraphs(
      "گھنے جنگل کے کنارے ایک ننھا ہاتھی رہتا تھا جس کا نام موٹو تھا۔ موٹو دل کا بہت اچھا تھا، مگر اس کا قد چھوٹا تھا۔ بڑے ہاتھی اسے اپنے کھیلوں میں شامل نہیں کرتے تھے اور وہ اکثر ندی کے کنارے اکیلا بیٹھا رہتا تھا۔",
      "ایک صبح جب موٹو اداس بیٹھا پانی میں اپنی سونڈ ہلا رہا تھا، تو ایک چھوٹی سی چڑیا اڑتی ہوئی آئی اور اس کے کان پر بیٹھ گئی۔ تم اتنے اداس کیوں ہو، موٹو؟ چڑیا نے چہچہا کر پوچھا۔ موٹو نے اپنی ساری کہانی سنا دی۔ چڑیا ہنسی اور بولی، قد چھوٹا ہونے سے کیا ہوتا ہے؟ اصل چیز تو بڑا دل ہے۔ آج سے ہم دونوں دوست ہیں!",
      "اس دن کے بعد دونوں کی دوستی گہری ہوتی گئی۔ چڑیا روز صبح موٹو کو جنگل کی خبریں سناتی — کہاں میٹھے بیر لگے ہیں، کہاں نئی ندی بہہ رہی ہے۔ اور موٹو چڑیا کو اپنی سونڈ پر بٹھا کر پورے جنگل کی سیر کراتا۔ دونوں بہت خوش تھے۔",
      "ایک دن چڑیا نے درخت کی اونچی شاخ سے دیکھا کہ کچھ شکاری جنگل میں جال بچھا رہے ہیں۔ وہ بجلی کی طرح اڑی اور موٹو کو خبردار کیا۔ موٹو نے فوراً اپنی سونڈ اونچی کر کے زور سے چنگھاڑا۔ اس کی آواز سن کر سارے جانور ہوشیار ہو گئے اور محفوظ جگہوں پر چھپ گئے۔ شکاری شام تک انتظار کرتے رہے، مگر انہیں کوئی جانور نہ ملا اور وہ خالی ہاتھ لوٹ گئے۔",
      "اس دن جنگل کے سب جانوروں نے ایک قیمتی سبق سیکھا: سچی دوستی قد، رنگ یا طاقت نہیں دیکھتی۔ بڑے ہاتھیوں نے بھی موٹو سے معافی مانگی اور اسے اپنے ساتھ کھیلنے کی دعوت دی۔ مگر موٹو کی سب سے پیاری دوست آج بھی وہی ننھی چڑیا ہے۔"
    ),
  },

  // ------------------------------------------------------------------
  // 3. Kids — English bedtime story (~250 words)
  // ------------------------------------------------------------------
  {
    title: "The Lantern Fox",
    language: "en",
    category: "bedtime",
    tags: ["bedtime", "kindness", "animals"],
    isKids: true,
    content: paragraphs(
      "In a forest where the trees grew so tall they tickled the clouds, there lived a small fox named Pip. Pip was not the fastest fox, nor the cleverest, but he had something special: a little brass lantern that glowed with captured moonlight.",
      "Every evening, when the sun went to sleep, Pip would light his lantern and walk the forest paths. The hedgehogs were afraid of the dark, the baby owls kept losing their way home, and old Tortoise walked so slowly that night always caught him halfway.",
      "Pip never hurried anyone. He simply walked beside them, his lantern swinging, humming a soft tune until each of them reached home safely. The forest animals began to call the winding path Lantern Lane, and they left little gifts for Pip along the way — berries, shiny pebbles, and once, a feather from the proudest peacock.",
      "One winter night the moon hid behind thick clouds, and Pip's lantern began to fade. The animals saw his worried face and gathered round. Each of them breathed gently on the lantern — hedgehogs, owls, tortoise, even the peacock — and with every warm breath the light grew stronger, until it shone brighter than ever before.",
      "Pip learned that night what the forest had known all along: kindness is a lantern too, and when everyone shares a little light, nobody has to walk home in the dark.",
      "So if you ever see a warm glow moving between the trees at bedtime, wave hello. It might just be Pip, on his evening round. Goodnight."
    ),
  },

  // ------------------------------------------------------------------
  // 4. General — Urdu essay (~400 words)
  // ------------------------------------------------------------------
  {
    title: "کتاب: انسان کی بہترین دوست",
    language: "ur",
    category: "essays",
    tags: ["کتاب", "مطالعہ", "مضمون"],
    isKids: false,
    content: paragraphs(
      "کہا جاتا ہے کہ کتاب انسان کی بہترین دوست ہے۔ یہ محاورہ صدیوں پرانا ہے، مگر آج کے ڈیجیٹل دور میں اس کی اہمیت پہلے سے کہیں زیادہ بڑھ گئی ہے۔ جب ہر طرف شور، جلد بازی اور سطحی معلومات کا ہجوم ہے، تو کتاب وہ خاموش دوست ہے جو ہمیں ٹھہر کر سوچنے کا موقع دیتی ہے۔",
      "کتاب کی سب سے بڑی خوبی یہ ہے کہ وہ کبھی دھوکہ نہیں دیتی۔ دوست بدل سکتے ہیں، حالات بدل سکتے ہیں، مگر ایک اچھی کتاب ہر بار پڑھنے پر نیا سبق دیتی ہے۔ بچپن میں پڑھی ہوئی کہانی جوانی میں نیا مفہوم دیتی ہے، اور جوانی کی کتاب بڑھاپے میں نئی حکمت سکھاتی ہے۔ یہی کتاب کا کمال ہے کہ وہ پڑھنے والے کے ساتھ ساتھ بڑھتی ہے۔",
      "مطالعے کی عادت انسان کی شخصیت کو نکھارتی ہے۔ جو شخص باقاعدگی سے پڑھتا ہے، اس کی سوچ وسیع ہوتی ہے، اس کا ذخیرہ الفاظ بڑھتا ہے، اور وہ دوسروں کی بات بہتر طور پر سمجھ سکتا ہے۔ تحقیق سے ثابت ہوا ہے کہ روزانہ صرف بیس منٹ کا مطالعہ ذہنی دباؤ کم کرتا ہے اور تخلیقی سوچ کو بڑھاتا ہے۔",
      "بدقسمتی سے ہمارے معاشرے میں مطالعے کی عادت کم ہوتی جا رہی ہے۔ موبائل فون کی اسکرین نے کتاب کی جگہ لے لی ہے۔ مگر یہاں ایک فرق سمجھنا ضروری ہے: اسکرین پر گھنٹوں گزارنا معلومات کا بوجھ تو بڑھا سکتا ہے، مگر گہرا علم اور فہم صرف کتاب ہی دیتی ہے۔ سوشل میڈیا ہمیں خبر دیتا ہے، کتاب ہمیں سمجھ دیتی ہے۔",
      "اچھی خبر یہ ہے کہ کتاب اب صرف کاغذ تک محدود نہیں رہی۔ ای بکس اور آڈیو کتابوں نے مطالعے کو ہر ایک کی پہنچ میں کر دیا ہے۔ سفر کے دوران آڈیو کتاب سننا یا فون پر ای بک پڑھنا بھی اسی عادت کا حصہ ہے۔ اصل چیز ذریعہ نہیں، عادت ہے۔",
      "آخر میں یہی کہا جا سکتا ہے کہ جو قومیں پڑھتی ہیں، وہی ترقی کرتی ہیں۔ اگر ہم چاہتے ہیں کہ ہمارے بچے بہتر مستقبل بنائیں، تو ہمیں انہیں کتاب سے دوستی کرانی ہوگی۔ گھر میں ایک چھوٹی سی لائبریری بنائیں، بچوں کو تحفے میں کتاب دیں، اور خود بھی پڑھ کر مثال قائم کریں۔ کیونکہ کتاب صرف کاغذ کے اوراق نہیں، یہ آنے والی نسلوں کی امانت ہے۔"
    ),
  },

  // ------------------------------------------------------------------
  // 5. General — English short story (~500 words)
  // ------------------------------------------------------------------
  {
    title: "The Last Bus to Hunza",
    language: "en",
    category: "short-stories",
    tags: ["travel", "memory", "short story"],
    isKids: false,
    content: paragraphs(
      "The bus was supposed to leave at nine. By half past ten, the driver was still drinking chai at the stall across the road, and nobody in the waiting crowd seemed particularly bothered except me.",
      "I had come to Gilgit on a whim — a cancelled meeting, a cheap ticket, and a childhood promise to see the mountains my grandfather used to describe. He had driven trucks on the Karakoram Highway in the seventies, and his stories had planted Hunza in my imagination like a flag: apricot orchards, a valley so green it looked photoshopped, old men playing polo.",
      "\"First time?\" asked the woman on the bench beside me. She must have been seventy, wrapped in a shawl despite the afternoon heat, a cloth bundle on her lap.",
      "\"That obvious?\" I said.",
      "She laughed. \"You keep checking your watch. Nobody checks their watch here unless they are new.\" She told me her name was Zarina, that she was going to Karimabad to see her first grandchild, and that she had made this journey forty-three times. \"The mountains are in no hurry,\" she said. \"Why should we be?\"",
      "The driver finally climbed aboard at eleven, and the bus groaned out of the station. For the first hour the road followed the river, and I understood what my grandfather had meant. The water was the colour of milky jade, and the cliffs rose on either side like the walls of some enormous, unfinished cathedral.",
      "Zarina shared her bundle with me — dried apricots, still warm from the sun they had been dried under. \"From my own trees,\" she said proudly. \"In Hunza, a guest is never hungry.\"",
      "Halfway through the journey, the bus stopped at a roadside hotel where the driver announced a thirty-minute break that lasted an hour. The other passengers played cards. Zarina and I sat on a charpai and watched the light change on the peaks. She told me about the winter of 1974, when the snow buried the road for weeks and the whole valley shared whatever they had. \"That is when I learned,\" she said, \"that a place is not its roads or its houses. A place is its people, deciding to be kind.\"",
      "We reached Karimabad after dark. Zarina's son was waiting with a lantern, and the baby — the whole reason for her forty-fourth journey — was asleep in his arms. She pressed the remaining apricots into my hands and refused to let me carry her bundle even one step. \"You are a guest of the valley now,\" she said, as if it were an official title.",
      "I never did see the polo match, and the orchards were between seasons. But standing in that dark courtyard, eating sun-warm apricots while a grandmother met her grandchild for the first time, I felt I had seen the real Hunza — the one my grandfather had been trying to describe all along.",
      "The bus back was on time. Nobody believed me."
    ),
  },

  // ------------------------------------------------------------------
  // 6. General — English poem
  // ------------------------------------------------------------------
  {
    title: "Monsoon Song",
    language: "en",
    category: "poetry",
    tags: ["poem", "rain", "monsoon"],
    isKids: false,
    content: paragraphs(
      "The sky turns the colour of old coins,\nand the courtyard holds its breath.\nSomewhere beyond the neem tree,\nthunder clears its throat.",
      "Then — the first drops, fat as marbles,\n drumming on the tin roof,\nchasing the dust from the bricks,\nwaking the sleeping earth.",
      "Children spill from doorways,\narms wide, faces upturned,\nwhile the gutters sing their silver song\nand paper boats set sail.",
      "O rain, you wash the city clean,\nyou soften what the summer burned.\nFor an hour, the whole world smells\nof wet soil and return."
    ),
  },
];

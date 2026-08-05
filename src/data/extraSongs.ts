import type { Category, JLPTLevel, SongPack, StudyLine } from "./studyContent";

interface SongSeed {
  id: string;
  artist: string;
  artistJp: string;
  titleJp: string;
  titleRomaji: string;
  titleEn: string;
  titleZh: string;
  category: Category;
  level: JLPTLevel | "N3+";
  mood: string;
}

const linePool: StudyLine[][] = [
  [
    {
      id: "advanced-night-1",
      japanese: "孤独な夜に君の声が響く。",
      kana: "こどくな よるに きみの こえが ひびく。",
      romaji: "kodoku na yoru ni kimi no koe ga hibiku.",
      zh: "在孤独的夜里，你的声音回响。",
      en: "On a lonely night, your voice echoes.",
      tokenIds: ["kodoku", "yoru", "pt-ni", "kimi", "pt-no", "koe", "pt-ga", "hibiku"]
    },
    {
      id: "advanced-night-2",
      japanese: "痛みを言葉に変えて未来へ走る。",
      kana: "いたみを ことばに かえて みらいへ はしる。",
      romaji: "itami o kotoba ni kaete mirai e hashiru.",
      zh: "把伤痛变成语言，向未来奔跑。",
      en: "I turn pain into words and run toward the future.",
      tokenIds: ["itami", "pt-wo", "kotoba", "pt-ni", "kaeru-transitive", "mirai", "pt-he", "hashiru"]
    }
  ],
  [
    {
      id: "city-light-1",
      japanese: "透明な朝に新しい扉を開ける。",
      kana: "とうめいな あさに あたらしい とびらを あける。",
      romaji: "toumei na asa ni atarashii tobira o akeru.",
      zh: "在透明的早晨打开新的门。",
      en: "On a clear morning, I open a new door.",
      tokenIds: ["toumei", "asa", "pt-ni", "tobira", "pt-wo"]
    },
    {
      id: "city-light-2",
      japanese: "光と影の間で本当の名前を探す。",
      kana: "ひかりと かげの あいだで ほんとうの なまえを さがす。",
      romaji: "hikari to kage no aida de hontou no namae o sagasu.",
      zh: "在光与影之间寻找真正的名字。",
      en: "Between light and shadow, I search for a true name.",
      tokenIds: ["hikari", "pt-to", "kage", "pt-no", "aida", "pt-de", "hontou", "pt-no", "namae", "pt-wo", "sagasu"]
    }
  ],
  [
    {
      id: "band-thorn-1",
      japanese: "棘のある言葉も音に変える。",
      kana: "とげの ある ことばも おとに かえる。",
      romaji: "toge no aru kotoba mo oto ni kaeru.",
      zh: "带刺的话语也变成声音。",
      en: "Even thorny words turn into sound.",
      tokenIds: ["toge", "pt-no", "aux-aru", "kotoba", "pt-mo", "oto", "pt-ni", "kaeru-transitive"]
    },
    {
      id: "band-thorn-2",
      japanese: "仲間と夜明けまで自由な声で歌う。",
      kana: "なかまと よあけまで じゆうな こえで うたう。",
      romaji: "nakama to yoake made jiyuu na koe de utau.",
      zh: "和伙伴用自由的声音唱到黎明。",
      en: "With my companions, I sing freely until dawn.",
      tokenIds: ["nakama", "pt-to", "yoake", "pt-made", "jiyuu", "koe", "pt-de", "utau"]
    }
  ],
  [
    {
      id: "vocaloid-future-1",
      japanese: "初音の声が未来へ希望を送る。",
      kana: "はつねの こえが みらいへ きぼうを おくる。",
      romaji: "hatsune no koe ga mirai e kibou o okuru.",
      zh: "初音的声音向未来送出希望。",
      en: "Hatsune's voice sends hope toward the future.",
      tokenIds: ["hatsune", "pt-no", "koe", "pt-ga", "mirai", "pt-he", "kibou", "pt-wo", "okuru"]
    },
    {
      id: "vocaloid-future-2",
      japanese: "嘘と本当の間で世界が変わる。",
      kana: "うそと ほんとうの あいだで せかいが かわる。",
      romaji: "uso to hontou no aida de sekai ga kawaru.",
      zh: "在谎言和真实之间，世界改变。",
      en: "Between lies and truth, the world changes.",
      tokenIds: ["uso", "pt-to", "hontou", "pt-no", "aida", "pt-de", "sekai", "pt-ga", "kawaru"]
    }
  ]
];

const seeds: SongSeed[] = [
  { id: "fujii-kaze-kirari", artist: "Fujii Kaze", artistJp: "藤井 風", titleJp: "きらり", titleRomaji: "Kirari", titleEn: "Sparkle", titleZh: "闪耀", category: "jpop", level: "N2", mood: "light, speed, renewal" },
  { id: "fujii-kaze-nan-nan", artist: "Fujii Kaze", artistJp: "藤井 風", titleJp: "何なんw", titleRomaji: "Nan-Nan", titleEn: "What Is It?", titleZh: "什么啊", category: "jpop", level: "N2", mood: "irony, groove" },
  { id: "fujii-kaze-garden", artist: "Fujii Kaze", artistJp: "藤井 風", titleJp: "ガーデン", titleRomaji: "Garden", titleEn: "Garden", titleZh: "花园", category: "jpop", level: "N2", mood: "nature, devotion" },
  { id: "fujii-kaze-hana", artist: "Fujii Kaze", artistJp: "藤井 風", titleJp: "花", titleRomaji: "Hana", titleEn: "Flower", titleZh: "花", category: "jpop", level: "N2", mood: "bloom, self" },
  { id: "fujii-kaze-michi-teyu-ku", artist: "Fujii Kaze", artistJp: "藤井 風", titleJp: "満ちてゆく", titleRomaji: "Michi Teyu Ku", titleEn: "Overflowing", titleZh: "渐渐充盈", category: "jpop", level: "N1", mood: "life, release" },
  { id: "vaundy-tokyo-flash", artist: "Vaundy", artistJp: "Vaundy", titleJp: "東京フラッシュ", titleRomaji: "Tokyo Flash", titleEn: "Tokyo Flash", titleZh: "东京闪光", category: "jpop", level: "N2", mood: "city, neon" },
  { id: "vaundy-fukakoryoku", artist: "Vaundy", artistJp: "Vaundy", titleJp: "不可幸力", titleRomaji: "Fukakouryoku", titleEn: "Unhappy Force", titleZh: "不可幸力", category: "jpop", level: "N1", mood: "society, contradiction" },
  { id: "vaundy-napori", artist: "Vaundy", artistJp: "Vaundy", titleJp: "napori", titleRomaji: "Napori", titleEn: "Napori", titleZh: "napori", category: "jpop", level: "N2", mood: "memory, room" },
  { id: "vaundy-chainsaw-blood", artist: "Vaundy", artistJp: "Vaundy", titleJp: "CHAINSAW BLOOD", titleRomaji: "Chainsaw Blood", titleEn: "Chainsaw Blood", titleZh: "链锯之血", category: "jpop", level: "N2", mood: "speed, impact" },
  { id: "vaundy-mabataki", artist: "Vaundy", artistJp: "Vaundy", titleJp: "瞳惚れ", titleRomaji: "Mabataki", titleEn: "Enchanted Eyes", titleZh: "迷恋眼眸", category: "jpop", level: "N1", mood: "gaze, desire" },
  { id: "yonezu-kanden", artist: "Kenshi Yonezu", artistJp: "米津玄師", titleJp: "感電", titleRomaji: "Kanden", titleEn: "Electric Shock", titleZh: "感电", category: "jpop", level: "N2", mood: "spark, city" },
  { id: "yonezu-lady", artist: "Kenshi Yonezu", artistJp: "米津玄師", titleJp: "LADY", titleRomaji: "Lady", titleEn: "Lady", titleZh: "Lady", category: "jpop", level: "N2", mood: "light, tenderness" },
  { id: "yonezu-m87", artist: "Kenshi Yonezu", artistJp: "米津玄師", titleJp: "M八七", titleRomaji: "M87", titleEn: "M87", titleZh: "M八七", category: "jpop", level: "N1", mood: "cosmos, resolve" },
  { id: "yonezu-chikyugi", artist: "Kenshi Yonezu", artistJp: "米津玄師", titleJp: "地球儀", titleRomaji: "Chikyugi", titleEn: "Spinning Globe", titleZh: "地球仪", category: "jpop", level: "N1", mood: "journey, memory" },
  { id: "yonezu-sayonara", artist: "Kenshi Yonezu", artistJp: "米津玄師", titleJp: "さよーならまたいつか！", titleRomaji: "Sayonara Mata Itsuka", titleEn: "Goodbye, See You Someday", titleZh: "再见总有一天", category: "jpop", level: "N2", mood: "farewell, stride" },
  { id: "yoasobi-idol", artist: "YOASOBI", artistJp: "YOASOBI", titleJp: "アイドル", titleRomaji: "Idol", titleEn: "Idol", titleZh: "偶像", category: "jpop", level: "N2", mood: "performance, mask" },
  { id: "yoasobi-yoru-ni-kakeru", artist: "YOASOBI", artistJp: "YOASOBI", titleJp: "夜に駆ける", titleRomaji: "Yoru ni Kakeru", titleEn: "Racing Into the Night", titleZh: "奔向夜晚", category: "jpop", level: "N2", mood: "night, escape" },
  { id: "ado-show", artist: "Ado", artistJp: "Ado", titleJp: "唱", titleRomaji: "Show", titleEn: "Show", titleZh: "唱", category: "jpop", level: "N2", mood: "stage, command" },
  { id: "ado-usseewa", artist: "Ado", artistJp: "Ado", titleJp: "うっせぇわ", titleRomaji: "Usseewa", titleEn: "Shut Up", titleZh: "烦死了", category: "jpop", level: "N1", mood: "anger, society" },
  { id: "king-gnu-specialz", artist: "King Gnu", artistJp: "King Gnu", titleJp: "SPECIALZ", titleRomaji: "Specialz", titleEn: "Specialz", titleZh: "SPECIALZ", category: "jpop", level: "N2", mood: "chaos, heat" },
  { id: "king-gnu-hakujitsu", artist: "King Gnu", artistJp: "King Gnu", titleJp: "白日", titleRomaji: "Hakujitsu", titleEn: "White Day", titleZh: "白日", category: "jpop", level: "N1", mood: "guilt, snow" },
  { id: "mrs-green-apple-lilac", artist: "Mrs. GREEN APPLE", artistJp: "Mrs. GREEN APPLE", titleJp: "ライラック", titleRomaji: "Lilac", titleEn: "Lilac", titleZh: "丁香", category: "jpop", level: "N2", mood: "youth, spring" },
  { id: "eve-kaikai-kitan", artist: "Eve", artistJp: "Eve", titleJp: "廻廻奇譚", titleRomaji: "Kaikai Kitan", titleEn: "Kaikai Kitan", titleZh: "回回奇谭", category: "jpop", level: "N1", mood: "curse, speed" },
  { id: "toge-zattou-bokura-no-machi", artist: "Togenashi Togeari", artistJp: "トゲナシトゲアリ", titleJp: "雑踏、僕らの街", titleRomaji: "Zattou, Bokura no Machi", titleEn: "Crowds, Our Town", titleZh: "人潮，我们的街", category: "band", level: "N1", mood: "street, band" },
  { id: "toge-dare-ni-mo-narenai", artist: "Togenashi Togeari", artistJp: "トゲナシトゲアリ", titleJp: "誰にもなれない私だから", titleRomaji: "Dare ni mo Narenai Watashi Dakara", titleEn: "Because I Cannot Become Anyone Else", titleZh: "正因为我无法成为别人", category: "band", level: "N1", mood: "identity, shout" },
  { id: "toge-sora-no-hako", artist: "Togenashi Togeari", artistJp: "トゲナシトゲアリ", titleJp: "空の箱", titleRomaji: "Sora no Hako", titleEn: "Empty Box", titleZh: "空箱", category: "band", level: "N2", mood: "emptiness, voice" },
  { id: "vocaloid-hibana", artist: "DECO*27 feat. Hatsune Miku", artistJp: "DECO*27 feat. 初音ミク", titleJp: "ヒバナ", titleRomaji: "Hibana", titleEn: "Spark", titleZh: "火花", category: "vocaloid", level: "N2", mood: "spark, conflict" },
  { id: "vocaloid-ghost-rule", artist: "DECO*27 feat. Hatsune Miku", artistJp: "DECO*27 feat. 初音ミク", titleJp: "ゴーストルール", titleRomaji: "Ghost Rule", titleEn: "Ghost Rule", titleZh: "幽灵法则", category: "vocaloid", level: "N2", mood: "lie, identity" },
  { id: "vocaloid-vampire", artist: "DECO*27 feat. Hatsune Miku", artistJp: "DECO*27 feat. 初音ミク", titleJp: "ヴァンパイア", titleRomaji: "The Vampire", titleEn: "The Vampire", titleZh: "吸血鬼", category: "vocaloid", level: "N2", mood: "desire, pop" },
  { id: "vocaloid-kamippoi-na", artist: "PinocchioP feat. Hatsune Miku", artistJp: "ピノキオピー feat. 初音ミク", titleJp: "神っぽいな", titleRomaji: "Kamippoi na", titleEn: "God-ish", titleZh: "像神一样", category: "vocaloid", level: "N1", mood: "irony, society" },
  { id: "vocaloid-anonymous-m", artist: "PinocchioP feat. Hatsune Miku", artistJp: "ピノキオピー feat. 初音ミク", titleJp: "匿名M", titleRomaji: "Anonymous M", titleEn: "Anonymous M", titleZh: "匿名M", category: "vocaloid", level: "N2", mood: "voice, identity" },
  { id: "vocaloid-rolling-girl", artist: "wowaka feat. Hatsune Miku", artistJp: "wowaka feat. 初音ミク", titleJp: "ローリンガール", titleRomaji: "Rolling Girl", titleEn: "Rolling Girl", titleZh: "Rolling Girl", category: "vocaloid", level: "N2", mood: "motion, pain" },
  { id: "vocaloid-unknown-mother-goose", artist: "wowaka feat. Hatsune Miku", artistJp: "wowaka feat. 初音ミク", titleJp: "アンノウン・マザーグース", titleRomaji: "Unknown Mother-Goose", titleEn: "Unknown Mother-Goose", titleZh: "未知鹅妈妈", category: "vocaloid", level: "N1", mood: "poetry, loss" },
  { id: "vocaloid-king", artist: "Kanaria feat. GUMI", artistJp: "Kanaria feat. GUMI", titleJp: "KING", titleRomaji: "King", titleEn: "King", titleZh: "KING", category: "vocaloid", level: "N2", mood: "power, game" },
  { id: "vocaloid-yowamushi-montblanc", artist: "DECO*27 feat. GUMI", artistJp: "DECO*27 feat. GUMI", titleJp: "弱虫モンブラン", titleRomaji: "Yowamushi Montblanc", titleEn: "Coward Mont Blanc", titleZh: "胆小鬼蒙布朗", category: "vocaloid", level: "N2", mood: "sweet, regret" },
  { id: "vocaloid-yoidore-shirazu", artist: "Kanaria feat. GUMI", artistJp: "Kanaria feat. GUMI", titleJp: "酔いどれ知らず", titleRomaji: "Yoidore Shirazu", titleEn: "Drunkenness Unaware", titleZh: "不知醉", category: "vocaloid", level: "N1", mood: "haze, rhythm" },
  { id: "vocaloid-aishite", artist: "Kikuo feat. Hatsune Miku", artistJp: "きくお feat. 初音ミク", titleJp: "愛して愛して愛して", titleRomaji: "Aishite Aishite Aishite", titleEn: "Love Me, Love Me, Love Me", titleZh: "爱我爱我爱我", category: "vocaloid", level: "N1", mood: "obsession, darkness" },
  { id: "vocaloid-umiyuri", artist: "n-buna feat. Hatsune Miku", artistJp: "n-buna feat. 初音ミク", titleJp: "ウミユリ海底譚", titleRomaji: "Umiyuri Kaiteitan", titleEn: "Deep-Sea Lily Tale", titleZh: "海百合海底谭", category: "vocaloid", level: "N1", mood: "sea, memory" },
  { id: "vocaloid-asuno-yozora", artist: "Orangestar feat. IA", artistJp: "Orangestar feat. IA", titleJp: "アスノヨゾラ哨戒班", titleRomaji: "Asu no Yozora Shoukaihan", titleEn: "Night Sky Patrol of Tomorrow", titleZh: "明日夜空哨戒班", category: "vocaloid", level: "N1", mood: "sky, future" },
  { id: "vocaloid-roki", artist: "MikitoP feat. Kagamine Rin", artistJp: "みきとP feat. 鏡音リン", titleJp: "ロキ", titleRomaji: "Roki", titleEn: "Roki", titleZh: "ROKI", category: "vocaloid", level: "N2", mood: "rock, self" }
];

function songLinks(seed: SongSeed) {
  const q = encodeURIComponent(`${seed.artist} ${seed.titleJp}`);
  if (seed.category === "vocaloid") {
    return [
      { label: "VocaDB", url: `https://vocadb.net/Search?searchType=Song&filter=${q}` },
      { label: "Official video search", url: `https://www.youtube.com/results?search_query=${q}%20official` }
    ];
  }
  return [
    { label: "Official video search", url: `https://www.youtube.com/results?search_query=${q}%20official` },
    { label: "Lyrics search", url: `https://j-lyric.net/index.php?kt=${encodeURIComponent(seed.titleJp)}` }
  ];
}

export const extraSongPacks: SongPack[] = seeds.map((seed, index) => ({
  ...seed,
  descriptionZh: `${seed.titleJp} 的学习包，偏 ${seed.level} 词汇和${seed.mood}意象。内置句子为原创练习句。`,
  descriptionEn: `${seed.titleEn} study pack with original practice lines for ${seed.level} vocabulary.`,
  sourceLinks: songLinks(seed),
  lines: linePool[index % linePool.length].map((line, lineIndex) => ({
    ...line,
    id: `${seed.id}-${lineIndex + 1}`
  }))
}));

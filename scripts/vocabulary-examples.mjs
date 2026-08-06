function cleanEnglish(value) {
  return String(value || "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstEnglish(value) {
  const segment =
    cleanEnglish(value)
      .split(/\s*;\s*/)
      .find(Boolean) || "the idea";
  return segment.replace(/^to\s+/i, "").replace(/^a\s+/i, "").trim();
}

function firstChinese(value) {
  const text =
    String(value || "")
      .replace(/^参考：/, "")
      .split("；")
      .find(Boolean)
      ?.trim() || "这个意思";
  return /[A-Za-z]/.test(text) ? "这个意思" : text;
}

function hasAny(value, words) {
  const lower = cleanEnglish(value).toLowerCase();
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(lower);
  });
}

function pick(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function hashSeed(...parts) {
  return parts
    .join("|")
    .split("")
    .reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 7);
}

function isVerb(word, en) {
  const lower = cleanEnglish(en).toLowerCase();
  return (
    lower.startsWith("to ") ||
    lower.includes("; to ") ||
    /する$/.test(word) ||
    /[うくぐすつぬぶむる]$/.test(word)
  );
}

function isIAdjective(word, en) {
  if (!/[い]$/.test(word) || isVerb(word, en)) return false;
  return hasAny(en, [
    "big",
    "small",
    "large",
    "little",
    "long",
    "short",
    "high",
    "low",
    "old",
    "new",
    "hot",
    "cold",
    "warm",
    "cool",
    "easy",
    "difficult",
    "hard",
    "fast",
    "slow",
    "bright",
    "dark",
    "wide",
    "narrow",
    "dirty",
    "correct",
    "wrong",
    "bad",
    "good",
    "sweet",
    "weak",
    "strong",
    "thin",
    "thick"
  ]);
}

function isNaAdjective(word, en) {
  if (isVerb(word, en) || isIAdjective(word, en)) return false;
  return (
    ["静か", "賑やか", "有名", "大切", "必要", "元気", "上手", "下手", "好き", "大好き", "嫌い", "綺麗"].includes(word) ||
    hasAny(en, ["quiet", "famous", "important", "necessary", "healthy", "skillful", "poor at", "like", "beautiful"])
  );
}

function buildAdverbExample(word, zh, en, seed) {
  if (hasAny(en, ["somewhere", "anywhere"])) {
    return {
      exampleJp: `鍵を${word}に置いた。`,
      exampleZh: `把钥匙放在了${zh}。`,
      exampleEn: `I put the key ${en}.`
    };
  }
  if (hasAny(en, ["perhaps", "possibly", "maybe"])) {
    return {
      exampleJp: `${word}明日は雨になる。`,
      exampleZh: `${zh}明天会下雨。`,
      exampleEn: `${en} it will rain tomorrow.`
    };
  }
  if (hasAny(en, ["sometimes", "often", "usually", "always", "occasionally"])) {
    return {
      exampleJp: `${word}この店に来る。`,
      exampleZh: `${zh}来这家店。`,
      exampleEn: `I ${en} come to this shop.`
    };
  }

  return pick(
    [
      {
        exampleJp: `${word}、予定を確認した。`,
        exampleZh: `${zh}确认了日程。`,
        exampleEn: `${en}, I checked the schedule.`
      },
      {
        exampleJp: `返事は${word}届いた。`,
        exampleZh: `回复${zh}到了。`,
        exampleEn: `The reply arrived ${en}.`
      }
    ],
    seed
  );
}

function buildVerbExample(word, zh, en, seed) {
  if (hasAny(en, ["remember", "learn", "memorize"])) {
    return {
      exampleJp: `新しい漢字は何度も書いて${word}。`,
      exampleZh: `新汉字要写很多遍来${zh}。`,
      exampleEn: `I write new kanji many times to ${en}.`
    };
  }
  if (hasAny(en, ["forget"])) {
    return {
      exampleJp: `大切な約束を${word}。`,
      exampleZh: `${zh}重要的约定。`,
      exampleEn: `I ${en} an important promise.`
    };
  }
  if (hasAny(en, ["say", "speak", "tell", "ask", "answer", "explain", "express", "call"])) {
    return {
      exampleJp: `会議で理由をはっきり${word}。`,
      exampleZh: `在会议上清楚地${zh}理由。`,
      exampleEn: `I clearly ${en} the reason in the meeting.`
    };
  }
  if (hasAny(en, ["read"])) {
    return {
      exampleJp: `朝の電車で新聞を${word}。`,
      exampleZh: `早上的电车里${zh}报纸。`,
      exampleEn: `I ${en} the newspaper on the morning train.`
    };
  }
  if (hasAny(en, ["write"])) {
    return {
      exampleJp: `ノートに名前を${word}。`,
      exampleZh: `在笔记本上${zh}名字。`,
      exampleEn: `I ${en} my name in the notebook.`
    };
  }
  if (hasAny(en, ["listen", "hear"])) {
    return {
      exampleJp: `静かな部屋で音を${word}。`,
      exampleZh: `在安静的房间里${zh}声音。`,
      exampleEn: `I ${en} the sound in a quiet room.`
    };
  }
  if (hasAny(en, ["see", "look", "watch"])) {
    return {
      exampleJp: `窓の外をじっと${word}。`,
      exampleZh: `凝视窗外，${zh}外面的景色。`,
      exampleEn: `I carefully ${en} outside the window.`
    };
  }
  if (hasAny(en, ["eat"])) {
    return {
      exampleJp: `昼に温かいご飯を${word}。`,
      exampleZh: `中午${zh}热饭。`,
      exampleEn: `I ${en} a warm meal at noon.`
    };
  }
  if (hasAny(en, ["drink"])) {
    return {
      exampleJp: `運動のあと水を${word}。`,
      exampleZh: `运动后${zh}水。`,
      exampleEn: `I ${en} water after exercising.`
    };
  }
  if (hasAny(en, ["go", "come", "return", "enter", "leave", "arrive", "reach"])) {
    return {
      exampleJp: `授業のあと駅へ${word}。`,
      exampleZh: `下课后${zh}车站。`,
      exampleEn: `After class, I ${en} to the station.`
    };
  }
  if (hasAny(en, ["retreat", "withdraw", "recede", "draw back"])) {
    return {
      exampleJp: `危ないと思ったらすぐ${word}。`,
      exampleZh: `觉得危险就马上退后。`,
      exampleEn: `If I sense danger, I ${en} right away.`
    };
  }
  if (hasAny(en, ["walk", "run", "fly", "climb", "ride"])) {
    return {
      exampleJp: `朝の公園をゆっくり${word}。`,
      exampleZh: `在早晨的公园里慢慢${zh}。`,
      exampleEn: `I slowly ${en} through the morning park.`
    };
  }
  if (hasAny(en, ["open", "close", "cut", "connect", "separate", "pull", "push", "hit"])) {
    return {
      exampleJp: `道具を使って丁寧に${word}。`,
      exampleZh: `用工具仔细地${zh}。`,
      exampleEn: `I carefully ${en} it with a tool.`
    };
  }
  if (hasAny(en, ["send", "receive", "give", "bring", "carry", "take", "borrow", "lend", "buy", "sell", "pay"])) {
    return {
      exampleJp: `友達に荷物を${word}。`,
      exampleZh: `向朋友${zh}包裹。`,
      exampleEn: `I ${en} a package for a friend.`
    };
  }
  if (hasAny(en, ["think", "understand", "know", "believe", "decide", "choose", "compare"])) {
    return {
      exampleJp: `答えを出す前によく${word}。`,
      exampleZh: `给出答案前好好${zh}。`,
      exampleEn: `I carefully ${en} before giving an answer.`
    };
  }
  if (hasAny(en, ["increase", "decrease", "raise", "lower", "change", "hasten", "quicken", "accelerate", "expedite"])) {
    return {
      exampleJp: `必要に応じて予定を少し${word}。`,
      exampleZh: `根据需要稍微调整日程。`,
      exampleEn: `I adjust the schedule slightly as needed.`
    };
  }
  if (hasAny(en, ["begin", "start", "finish", "end", "stop", "continue"])) {
    return {
      exampleJp: `会議は時間どおりに${word}。`,
      exampleZh: `会议按时${zh}。`,
      exampleEn: `The meeting ${en} on time.`
    };
  }
  if (hasAny(en, ["exist", "appear", "fall", "be born", "die", "become"])) {
    return {
      exampleJp: `静かな町に変化が${word}。`,
      exampleZh: `安静的城镇里变化开始${zh}。`,
      exampleEn: `A change ${en} in the quiet town.`
    };
  }

  return pick(
    [
      {
        exampleJp: `必要なときにすぐ${word}。`,
        exampleZh: `需要的时候马上${zh}。`,
        exampleEn: `I ${en} right away when needed.`
      },
      {
        exampleJp: `失敗しても、もう一度${word}。`,
        exampleZh: `就算失败，也再一次${zh}。`,
        exampleEn: `Even after failing, I ${en} once more.`
      },
      {
        exampleJp: `先生の前で落ち着いて${word}。`,
        exampleZh: `在老师面前冷静地${zh}。`,
        exampleEn: `I calmly ${en} in front of the teacher.`
      }
    ],
    seed
  );
}

function buildNounExample(word, zh, en, seed) {
  if (hasAny(en, ["agreement", "same opinion", "same feeling", "concurrence", "sympathy"])) {
    return pick(
      [
        {
          exampleJp: `彼の意見に${word}だ。`,
          exampleZh: `赞同他的意见；有${zh}的感觉。`,
          exampleEn: `I agree with his opinion.`
        },
        {
          exampleJp: `その考えには強く${word}した。`,
          exampleZh: `强烈赞同那个想法，产生了${zh}。`,
          exampleEn: `I strongly agreed with that idea.`
        }
      ],
      seed
    );
  }
  if (hasAny(en, ["windmill", "pinwheel"])) {
    return {
      exampleJp: `公園の${word}が風でゆっくり回る。`,
      exampleZh: `公园里的${zh}被风吹得慢慢转动。`,
      exampleEn: `The ${en} in the park turns slowly in the wind.`
    };
  }
  if (hasAny(en, ["betting", "gambling", "gamble"])) {
    return {
      exampleJp: `その${word}には大きなリスクがある。`,
      exampleZh: `那个${zh}有很大的风险。`,
      exampleEn: `That bet carries a big risk.`
    };
  }
  if (hasAny(en, ["somewhere", "anywhere", "perhaps", "possibly", "usually", "often", "sometimes"])) {
    return buildAdverbExample(word, zh, en, seed);
  }
  if (hasAny(en, ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow", "yesterday", "morning", "afternoon", "evening", "night", "week", "month", "year", "day", "spring", "summer", "autumn", "winter"])) {
    return pick(
      [
        {
          exampleJp: `${word}に友達と会う。`,
          exampleZh: `${zh}和朋友见面。`,
          exampleEn: `I meet a friend on ${en}.`
        },
        {
          exampleJp: `${word}は家で勉強した。`,
          exampleZh: `${zh}在家学习了。`,
          exampleEn: `On ${en}, I studied at home.`
        }
      ],
      seed
    );
  }
  if (hasAny(en, ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "hundred", "thousand", "zero", "number"])) {
    if (hasAny(en, ["one person", "alone"])) {
      return {
        exampleJp: `${word}で映画を見に行った。`,
        exampleZh: `一个人去看了电影。`,
        exampleEn: `I went to see a movie by myself.`
      };
    }
    return {
      exampleJp: `答えは${word}です。`,
      exampleZh: `答案是${zh}。`,
      exampleEn: `The answer is ${en}.`
    };
  }
  if (hasAny(en, ["father", "mother", "parent", "child", "boy", "girl", "student", "teacher", "doctor", "person", "people", "friend", "family", "adult", "younger", "older", "brother", "sister", "man", "woman"])) {
    return {
      exampleJp: `${word}に道を尋ねた。`,
      exampleZh: `向${zh}问路。`,
      exampleEn: `I asked ${en} for directions.`
    };
  }
  if (hasAny(en, ["school", "university", "hospital", "bank", "embassy", "station", "room", "house", "home", "park", "village", "country", "city", "office", "company", "shop", "garden", "entrance", "hallway", "place"])) {
    return pick(
      [
        {
          exampleJp: `${word}で友達を待った。`,
          exampleZh: `在${zh}等朋友。`,
          exampleEn: `I waited for a friend at the ${en}.`
        },
        {
          exampleJp: `週末に${word}へ行った。`,
          exampleZh: `周末去了${zh}。`,
          exampleEn: `I went to the ${en} on the weekend.`
        }
      ],
      seed
    );
  }
  if (hasAny(en, ["food", "meal", "breakfast", "lunch", "dinner", "meat", "beef", "pork", "chicken", "egg", "fruit", "cake", "sweet", "snack", "rice", "salt"])) {
    return {
      exampleJp: `昼に${word}を少し食べた。`,
      exampleZh: `中午吃了一点${zh}。`,
      exampleEn: `I ate a little ${en} at noon.`
    };
  }
  if (hasAny(en, ["water", "tea", "coffee", "alcohol", "drink", "medicine"])) {
    return {
      exampleJp: `食後に${word}を飲んだ。`,
      exampleZh: `饭后喝了${zh}。`,
      exampleEn: `I drank ${en} after the meal.`
    };
  }
  if (hasAny(en, ["rain", "snow", "wind", "cloud", "weather", "sky", "sea", "mountain", "tree", "flower", "sun", "light"])) {
    return pick(
      [
        {
          exampleJp: `${word}が窓の外に見える。`,
          exampleZh: `窗外能看到${zh}。`,
          exampleEn: `I can see ${en} outside the window.`
        },
        {
          exampleJp: `${word}の音で朝に気づいた。`,
          exampleZh: `因为${zh}的声音意识到早晨到了。`,
          exampleEn: `The sound of ${en} made me notice the morning.`
        }
      ],
      seed
    );
  }
  if (hasAny(en, ["hand", "foot", "leg", "arm", "body", "mouth", "tooth", "eye", "voice", "heart", "face"])) {
    return {
      exampleJp: `${word}が少し痛い。`,
      exampleZh: `${zh}有点痛。`,
      exampleEn: `My ${en} hurts a little.`
    };
  }
  if (hasAny(en, ["book", "dictionary", "newspaper", "magazine", "letter", "sentence", "article", "map", "ticket", "photo", "picture", "word", "language", "story", "music", "song", "sound", "voice"])) {
    return {
      exampleJp: `授業で${word}を声に出して読んだ。`,
      exampleZh: `在课堂上把${zh}读出了声。`,
      exampleEn: `I read the ${en} aloud in class.`
    };
  }
  if (hasAny(en, ["north", "south", "east", "west", "left", "right", "top", "bottom", "front", "back", "side", "up", "down", "direction"])) {
    const directionZh =
      hasAny(en, ["north"]) ? "北" :
      hasAny(en, ["south"]) ? "南" :
      hasAny(en, ["east"]) ? "东" :
      hasAny(en, ["west"]) ? "西" :
      hasAny(en, ["left"]) ? "左" :
      hasAny(en, ["right"]) ? "右" :
      hasAny(en, ["top", "up"]) ? "上" :
      hasAny(en, ["bottom", "down"]) ? "下" :
      hasAny(en, ["front"]) ? "前方" :
      hasAny(en, ["back"]) ? "后方" :
      zh;
    return {
      exampleJp: `${word}へまっすぐ進んだ。`,
      exampleZh: `朝${directionZh}直走。`,
      exampleEn: `I went straight toward the ${en}.`
    };
  }
  if (hasAny(en, ["bag", "wallet", "key", "clock", "watch", "phone", "pen", "pencil", "notebook", "desk", "chair", "refrigerator", "door", "window", "shoe", "sock", "clothes", "umbrella", "box", "plate", "bicycle", "car", "tool", "object", "thing"])) {
    return pick(
      [
        {
          exampleJp: `机の上に${word}を置いた。`,
          exampleZh: `把${zh}放在桌上。`,
          exampleEn: `I put the ${en} on the desk.`
        },
        {
          exampleJp: `${word}をかばんに入れた。`,
          exampleZh: `把${zh}放进包里。`,
          exampleEn: `I put the ${en} in my bag.`
        }
      ],
      seed
    );
  }

  return pick(
    [
      {
        exampleJp: `会議で${word}について話し合った。`,
        exampleZh: `在会议上讨论了${zh}。`,
        exampleEn: `We discussed ${en} in the meeting.`
      },
      {
        exampleJp: `その経験から${word}の大切さを知った。`,
        exampleZh: `从那次经历中明白了${zh}的重要性。`,
        exampleEn: `That experience taught me the importance of ${en}.`
      },
      {
        exampleJp: `この問題には${word}が深く関係している。`,
        exampleZh: `这个问题和${zh}有很深的关系。`,
        exampleEn: `${en} is deeply connected to this problem.`
      },
      {
        exampleJp: `授業で${word}を具体的に説明した。`,
        exampleZh: `在课堂上具体说明了${zh}。`,
        exampleEn: `I explained ${en} concretely in class.`
      }
    ],
    seed
  );
}

function buildAdjectiveExample(word, zh, en, seed) {
  if (isNaAdjective(word, en)) {
    return pick(
      [
        {
          exampleJp: `${word}な場所で静かに休んだ。`,
          exampleZh: `在${zh}的地方安静地休息。`,
          exampleEn: `I rested quietly in a place that feels ${en}.`
        },
        {
          exampleJp: `${word}な資料を先に確認した。`,
          exampleZh: `先确认了${zh}的资料。`,
          exampleEn: `I checked the ${en} materials first.`
        }
      ],
      seed
    );
  }

  return pick(
    [
      {
        exampleJp: `この問題は少し${word}。`,
        exampleZh: `这个问题有点${zh}。`,
        exampleEn: `This problem is a little ${en}.`
      },
      {
        exampleJp: `今日は空気がとても${word}。`,
        exampleZh: `今天空气很${zh}。`,
        exampleEn: `The air feels very ${en} today.`
      },
      {
        exampleJp: `この部屋は思ったより${word}。`,
        exampleZh: `这个房间比想象中更${zh}。`,
        exampleEn: `This room is more ${en} than I expected.`
      }
    ],
    seed
  );
}

export function buildVocabularyExample(word, index = 0) {
  const japanese = word.japanese || word.word || "";
  const zh = firstChinese(word.zh || word.chinese || "");
  const en = firstEnglish(word.en || word.meaning || "");
  const seed = hashSeed(japanese, word.kana || word.furigana || "", en, index);

  if (isIAdjective(japanese, word.en || word.meaning) || isNaAdjective(japanese, word.en || word.meaning)) {
    return buildAdjectiveExample(japanese, zh, en, seed);
  }
  if (isVerb(japanese, word.en || word.meaning)) {
    return buildVerbExample(japanese, zh, en, seed);
  }
  return buildNounExample(japanese, zh, en, seed);
}

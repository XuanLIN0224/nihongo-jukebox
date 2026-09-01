export interface GameTrack {
  id: string;
  title: string;
  file: string;
}

export interface GamePack {
  id: string;
  title: string;
  titleJp: string;
  descriptionZh: string;
  dataUrl: string;
  backgroundUrl: string;
  lineCount: number;
  nonDummyLineCount: number;
  tracks: GameTrack[];
}

export const gamePacks: GamePack[] = [
  {
    id: "persona5",
    title: "Persona 5",
    titleJp: "ペルソナ5",
    descriptionZh: "Persona 5 游戏文本中日英学习。每条消息独立保存句子进度。",
    dataUrl: "data/games/persona5-lines.json",
    backgroundUrl: "games/persona5/images/persona5-wallpaper.png",
    lineCount: 80459,
    nonDummyLineCount: 78730,
    tracks: [
      { id: "p5-phantom", title: "Phantom", file: "games/persona5/audio/1-02. Phantom.mp3" },
      { id: "p5-beneath-mask", title: "Beneath the Mask - instrumental", file: "games/persona5/audio/1-09. Beneath the Mask -instrumental version-.mp3" },
      { id: "p5-will-power", title: "Will Power", file: "games/persona5/audio/1-14. Will Power.mp3" },
      { id: "p5-confession-secret", title: "Confession - Secret", file: "games/persona5/audio/1-21. Confession - Secret.mp3" },
      { id: "p5-life-will-change", title: "Life Will Change - instrumental", file: "games/persona5/audio/1-24. Life Will Change -instrumental version-.mp3" },
      { id: "p5-blooming-villain", title: "Blooming Villain", file: "games/persona5/audio/1-26. Blooming Villain.mp3" },
      { id: "p5-regret", title: "Regret", file: "games/persona5/audio/1-27. Regret.mp3" },
      { id: "p5-keeper-of-lust", title: "Keeper of Lust", file: "games/persona5/audio/2-18. Keeper of Lust.mp3" },
      { id: "p5-when-mother-was-there", title: "When Mother Was There", file: "games/persona5/audio/2-23. When Mother Was There.mp3" },
      { id: "p5-beneath-mask-rain", title: "Beneath the Mask - rain instrumental", file: "games/persona5/audio/3-01. Beneath the Mask -rain, instrumental version-.mp3" },
      { id: "p5-wake-up-instrumental", title: "Wake Up, Get Up, Get Out There - instrumental", file: "games/persona5/audio/3-19. Wake Up, Get Up, Get Out There -instrumental version-.mp3" },
      { id: "p5-rivers-in-desert", title: "Rivers In the Desert - instrumental", file: "games/persona5/audio/3-20. Rivers In the Desert -instrumental version-.mp3" },
      { id: "p5-ideal-real", title: "Ideal and the Real - end version", file: "games/persona5/audio/5-12. Ideal and the Real -end version-.mp3" }
    ]
  }
];

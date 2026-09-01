import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(rootDir, "src/data/grammarStudy.ts");

const inputPaths = process.argv.slice(2);
if (inputPaths.length === 0) {
  console.error("Usage: node scripts/generate-blue-grammar.mjs /path/to/blue_toc_ocr.txt [...]");
  process.exit(1);
}

const levelsByImage = new Map([
  ["blue-toc-early-005.png", "N1"],
  ["blue-toc-early-006.png", "N1"],
  ["blue-toc-007.png", "N1"],
  ["blue-toc-008.png", "N1"],
  ["blue-toc-009.png", "N2"],
  ["blue-toc-010.png", "N2"],
  ["blue-toc-011.png", "N2"],
  ["blue-toc-012.png", "N3"],
  ["blue-toc-013.png", "N3"],
  ["blue-toc-014.png", "N3"],
  ["blue-toc-015.png", "N4"],
  ["blue-toc-016.png", "N4"],
  ["blue-toc-017.png", "N4"],
  ["blue-toc-018.png", "N5"],
  ["blue-toc-019.png", "N5"],
  ["blue-toc-020.png", "N5"]
]);

function parseOcr(paths) {
  const pages = [];
  for (const inputPath of paths) {
    const source = fs.readFileSync(inputPath, "utf8");
    let current = null;
    for (const line of source.split(/\n/)) {
      const header = line.match(/^===\s+(.+?)\s+===$/);
      if (header) {
        current = { image: header[1], lines: [] };
        pages.push(current);
        continue;
      }
      const match = line.match(/^(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(.+)$/);
      if (!match || !current) continue;
      current.lines.push({
        x: Number(match[1]),
        y: Number(match[2]),
        text: match[5].trim()
      });
    }
  }
  return pages;
}

function cleanPattern(value) {
  return value
    .replace(/[~〜]/g, "～")
    .replace(/／/g, "/")
    .replace(/[!！:：]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/\/?\d{1,3}$/g, "")
    .replace(/\/?\d{1,3}第\d+単元.*$/g, "")
    .replace(/第\d+単元.*$/g, "")
    .replace(/\/10XintuEc/g, "")
    .replace(/\/180Huaca/g, "")
    .replace(/\/191等/g, "")
    .replace(/\/204必ず\/20556/g, "")
    .replace(/\/\.223罪する\/223122/g, "/拝借する")
    .replace(/\/224124\.うる/g, "/承る")
    .replace(/\/234・司/g, "")
    .replace(/\/248※荷\/24844/g, "")
    .replace(/\/260囱教/g, "")
    .replace(/助効/g, "助動詞")
    .replace(/常用数量的法/g, "常用数量詞の使い方")
    .replace(/父かせない/g, "欠かせない")
    .replace(/荷もの/g, "何もの")
    .replace(/装ばない/g, "及ばない")
    .replace(/婚果/g, "結果")
    .replace(/か皆か/g, "か何か")
    .replace(/か荷か/g, "か何か")
    .replace(/荷でもない/g, "何でもない")
    .replace(/護ろ/g, "蔑ろ")
    .replace(/推え/g, "控え")
    .replace(/儀なく/g, "余儀なく")
    .replace(/朝自になる\/羽目に諸る/g, "羽目になる/羽目に陥る")
    .replace(/簡然/g, "同然")
    .replace(/営然/g, "同然")
    .replace(/ものとわれる/g, "ものと思われる")
    .replace(/発立って/g, "先立って")
    .replace(/にって\/に伴い/g, "に伴って/に伴い")
    .replace(/にして\/に反し/g, "に反して/に反し")
    .replace(/稲違/g, "相違")
    .replace(/～菌\/半面/g, "～反面/半面")
    .replace(/を心に/g, "を中心に")
    .replace(/購えませんか/g, "願えませんか")
    .replace(/単し上げる/g, "申し上げる")
    .replace(/荐じ/g, "存じ")
    .replace(/お自にかかる/g, "お目にかかる")
    .replace(/華覚/g, "拝見")
    .replace(/^罪する/g, "拝借する")
    .replace(/^うる/g, "承る")
    .replace(/名す/g, "召す")
    .replace(/^す$/g, "申す")
    .replace(/同\+すぎ\/まえ/g, "動詞＋すぎ/前")
    .replace(/50¥03/g, "そうです")
    .replace(/"ん\/510と/g, "の/こと")
    .replace(/場答/g, "場合")
    .replace(/て以菜/g, "て以来")
    .replace(/に男（で）/g, "上（で）")
    .replace(/1号だ/g, "一方だ")
    .replace(/～E$/g, "～ず")
    .replace(/置す/g, "直す")
    .replace(/受対に/g, "反対に")
    .replace(/に顔して\/に関しても\/にする/g, "に関して/に関しても/に関する")
    .replace(/高け/g, "向け")
    .replace(/^～?芳$/g, "～方")
    .replace(/[。.]$/g, "")
    .trim();
}

function extractEntries(pages) {
  const entries = [];
  for (const page of pages) {
    const level = levelsByImage.get(page.image);
    if (!level) continue;
    const columns = [
      page.lines.filter((line) => line.x < 0.5).sort((a, b) => b.y - a.y),
      page.lines.filter((line) => line.x >= 0.5).sort((a, b) => b.y - a.y)
    ];
    for (const column of columns) {
      let current = null;
      for (const line of column) {
        let text = line.text.replace(/^IntU$|^敬浯$|^敬語$|^泉$|^新$|^u$/g, "").trim();
        if (!text) continue;
        const started = text.match(/^(\d{1,3})[.．]?\s*(.+)$/);
        if (started && /[～おごぁ-んァ-ヶ一-龥]/.test(started[2])) {
          if (current) entries.push(current);
          current = {
            level,
            number: Number(started[1]),
            pattern: started[2]
          };
        } else if (current && !/^[0-9]+$/.test(text) && !/Huada|Education|北大|大新/.test(text)) {
          if (/第\d+単元|単元/.test(text)) continue;
          current.pattern += text;
        }
      }
      if (current) entries.push(current);
    }
  }

  const byKey = new Map();
  for (const entry of entries) {
    const pattern = cleanPattern(entry.pattern);
    if (!pattern || pattern.length > 80 || !/[ぁ-んァ-ヶ一-龥～]/.test(pattern)) continue;
    const key = `${entry.level}-${entry.number}`;
    byKey.set(key, {
      ...entry,
      pattern
    });
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const levelOrder = ["N1", "N2", "N3", "N4", "N5"];
    return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level) || a.number - b.number;
  });
}

function firstVariant(pattern) {
  return pattern
    .split("/")
    .map((item) => item.trim())
    .find((item) => item && !/^\d+$/.test(item)) ?? pattern;
}

const grammarRules = [
  [/あっての/, "有了前项才有后项；强调基础条件。", "only possible because of; depends on"],
  [/以外の何ものでもない/, "完全就是前项；用于强判断。", "nothing other than; exactly"],
  [/いかん/, "取决于前项；视情况而定。", "depending on; according to"],
  [/いざ/, "一旦真的到了某种场面。", "when it actually comes to"],
  [/今ひとつ.*ない/, "还差一点；不够理想。", "not quite; somewhat lacking"],
  [/うにも.*ない/, "想做也做不了；没有办法实现。", "cannot even if one tries"],
  [/言わずもがな/, "不说也明白；说了反而多余。", "needless to say; better left unsaid"],
  [/うが|うと/, "无论怎样都不改变后项。", "whether or not; no matter"],
  [/甲斐/, "表示努力是否值得、有无成效。", "worth; result of effort"],
  [/限りだ/, "非常...；强烈表达心情。", "extremely; deeply"],
  [/が最後|たら最後/, "一旦发生就无法回头。", "once ... happens, that's it"],
  [/かたがた/, "顺便兼做另一件事。", "while also; at the same time"],
  [/かたわら/, "一边做主业，一边做副业。", "while also doing"],
  [/がてら/, "顺便。", "while doing; incidentally"],
  [/早いか/, "刚一...就立刻...。", "as soon as"],
  [/からある|からする|からの/, "数量大到令人惊讶。", "as much as; no less than"],
  [/嫌いがある/, "有某种不太好的倾向。", "have a tendency to"],
  [/極まる|極まりない/, "极其...；语气正式强烈。", "extremely; utterly"],
  [/ごとき|ごとく|ごとし/, "像...一样；文语表达。", "like; as if"],
  [/ことだし/, "既然...，就...。", "since; considering"],
  [/ことなしに/, "不...就无法...。", "without doing"],
  [/こともあって/, "也因为...；前项是原因之一。", "partly because"],
  [/結果だ/, "正是因为前项造成结果。", "as a result of"],
  [/ずくめ/, "全都是...；清一色。", "all; entirely"],
  [/ずじまい/, "最终没能...。", "ended up not doing"],
  [/ずにはおかない/, "一定会引发；必然使人...。", "cannot help causing"],
  [/ずにはすまない/, "不...就说不过去。", "must; cannot get away without"],
  [/術がない/, "没有办法。", "there is no way"],
  [/すら/, "连...都；强调最低限度。", "even"],
  [/そばから/, "刚...就又...。", "as soon as; right after"],
  [/そびれる/, "错过做某事的机会。", "miss a chance to"],
  [/のみならず|だけでなく/, "不只是...，而且...。", "not only but also"],
  [/だけまし/, "至少还算比较好。", "at least better than"],
  [/のみだ/, "只是...而已。", "only; merely"],
  [/たところで/, "即使...也不会有好结果。", "even if; no matter"],
  [/だに/, "连...都；多用于否定或惊讶。", "even; just"],
  [/ためしがない/, "从来没有过。", "have never"],
  [/きりがない/, "没完没了。", "endless"],
  [/たりとも/, "即使一个也不。", "not even one"],
  [/たるもの/, "身为...就应该...。", "as; being"],
  [/つつ/, "一边...一边...；也可表示反复。", "while; repeatedly"],
  [/であれ/, "无论是...。", "whether; even if"],
  [/てからというもの/, "自从...以后一直。", "ever since"],
  [/てしかるべき/, "理应...。", "should naturally"],
  [/ではあるまいし|じゃあるまいし/, "又不是...；用于反驳。", "it's not as if"],
  [/かなわない|やりきれない/, "无法忍受；受不了。", "cannot stand"],
  [/ても差し支えない/, "即使...也无妨。", "may; it is fine to"],
  [/でもしたら/, "如果万一...。", "if by any chance"],
  [/ても知らない/, "如果...我可不管。", "don't blame me if"],
  [/でもって/, "用...；通过...。", "by means of"],
  [/てもどうにもならない/, "即使...也没办法。", "even doing so won't help"],
  [/てもともと/, "即使失败也无所谓。", "nothing to lose"],
  [/ても始まらない/, "即使...也无济于事。", "there is no point in"],
  [/てやまない/, "衷心地一直...。", "deeply; sincerely"],
  [/相まって/, "相互作用，共同造成。", "combined with"],
  [/とあって/, "因为是特殊情况。", "because; as it is"],
  [/とあれば/, "如果是为了...。", "if it is for"],
  [/といい.*といい/, "无论从哪方面看都...。", "both ... and ..."],
  [/というか/, "该说是...还是...。", "or rather; perhaps"],
  [/というところ|といったところ/, "大概也就是...程度。", "about; roughly"],
  [/というもの/, "这段时间以来。", "for; during"],
  [/といえども/, "即使是...也...。", "even though; even"],
  [/なくもない/, "不是完全不...。", "not entirely impossible"],
  [/ありはしない|ありゃしない/, "极其...；没有比这更...。", "extremely; absolutely"],
  [/といって.*ない/, "并不是说...。", "not to say that"],
  [/といわず/, "不论...还是...都。", "both ... and ..."],
  [/打って変わって/, "和之前完全不同。", "completely changed"],
  [/思いきや/, "原以为...结果却...。", "contrary to expectation"],
  [/ときたら/, "说到...可真是...。", "when it comes to"],
  [/ところを/, "在...的时候；承蒙。", "at the moment when"],
  [/としたことが/, "身为...竟然...。", "for someone like"],
  [/としたって|としたところで/, "即使假设...也...。", "even assuming"],
  [/として.*ない/, "连一个...都没有。", "not even one"],
  [/とて/, "即使...也。", "even; though"],
  [/とはいうものの|とはいえ/, "话虽如此。", "although; nevertheless"],
  [/とばかりに/, "像是在说...似的。", "as if to say"],
  [/まではいかない/, "还没到...程度。", "not quite as far as"],
  [/ともあろうものが/, "堂堂...竟然...。", "of all people"],
  [/ともなく/, "不知不觉地；无意识地。", "without consciously"],
  [/ともなると/, "一到...阶段。", "when it comes to"],
  [/を重ねて/, "反复...。", "repeatedly"],
  [/ないまでも/, "即使达不到...也至少...。", "even if not"],
  [/なくして/, "没有...就不能...。", "without"],
  [/なしに/, "不...；没有...。", "without"],
  [/ならいざしらず/, "如果是...还另说。", "it might be different if"],
  [/ならでは/, "只有...才有的。", "unique to"],
  [/なりとも/, "哪怕...也好。", "even; at least"],
  [/なり.*なり/, "或者...或者...。", "or; whether"],
  [/なりに/, "以...自己的方式。", "in one's own way"],
  [/に値する|に値しない/, "值得/不值得...。", "be worth"],
  [/あたらない/, "不必...。", "there is no need to"],
  [/にあって/, "处于...情况下。", "in; under"],
  [/に至って|に至る/, "到了...阶段。", "come to; reach"],
  [/に至るまで/, "甚至到...为止。", "all the way to"],
  [/に負うところ/, "很大程度归功于...。", "owe much to"],
  [/おかれましては/, "对...而言；敬语寒暄。", "regarding; for"],
  [/に及ばない/, "不必...；达不到...。", "need not; fall short of"],
  [/欠かせない/, "不可或缺。", "indispensable"],
  [/かかっている/, "取决于...。", "depend on"],
  [/にかかわる/, "关系到...。", "concern; affect"],
  [/限ったことではない/, "并不限于...。", "not limited to"],
  [/かこつけて/, "借口...。", "use as a pretext"],
  [/かたくない/, "不难...。", "not hard to"],
  [/かまけて/, "忙于...而忽略其他。", "be absorbed in"],
  [/越したことはない/, "最好是...。", "nothing is better than"],
  [/如くはない/, "不如...。", "nothing equals"],
  [/忍びない/, "不忍心...。", "cannot bear to"],
  [/準じ/, "按照/参照...。", "according to; equivalent to"],
  [/即し|則し/, "符合/依照...。", "in line with"],
  [/たえる|たえない/, "值得/不胜...。", "worthy of; unable to bear"],
  [/足りる|足る/, "足以...。", "sufficient to"],
  [/照らして/, "对照...。", "in light of"],
  [/とどまらず/, "不限于...。", "not limited to"],
  [/ひきかえ/, "与...相反。", "in contrast to"],
  [/ほどがある/, "也该有个限度。", "there is a limit to"],
  [/にも増して/, "比...更...。", "more than"],
  [/極み|至り/, "极其...；书面表达。", "the height of"],
  [/はおろか/, "别说...连...也。", "let alone"],
  [/ばこそ/, "正因为...才...。", "precisely because"],
  [/さておき/, "暂且不谈...。", "setting aside"],
  [/はずみ/, "在...瞬间/势头下。", "on the spur of"],
  [/そっちのけ/, "把...搁在一边。", "neglecting"],
  [/それまでだ/, "那就完了/到此为止。", "that's the end"],
  [/羽目/, "落到...地步。", "end up"],
  [/べからず|べからざる/, "禁止；不该...。", "must not"],
  [/べく/, "为了...；应该...。", "in order to; should"],
  [/べくもない/, "不可能...。", "cannot possibly"],
  [/まじき/, "不该有的。", "unbecoming"],
  [/までして/, "甚至做到...。", "go so far as to"],
  [/までもない/, "不必...。", "no need to"],
  [/まみれ/, "满是...。", "covered with"],
  [/めく/, "带有...气息。", "have a hint of"],
  [/顧みず/, "不顾...。", "regardless of"],
  [/さることながら/, "不用说...，更...。", "not to mention"],
  [/ものを/, "明明...却...。", "although; if only"],
  [/否や/, "刚一...就。", "as soon as"],
  [/やしない|はしない/, "绝不会...。", "will not at all"],
  [/矢先/, "正要...的时候。", "just when"],
  [/ゆえ/, "由于...；因为...。", "because of"],
  [/ようによっては/, "取决于做法/看法。", "depending on how"],
  [/をおいて/, "除了...没有。", "other than"],
  [/を押して|押し切って/, "不顾阻力坚持...。", "despite; push through"],
  [/を限りに/, "以...为最后期限。", "starting/ending with"],
  [/皮切り/, "以...为开端。", "starting with"],
  [/を機に/, "以...为契机。", "taking as an opportunity"],
  [/禁じ得ない/, "不禁...。", "cannot help"],
  [/蔑ろ|なおざり/, "轻视/敷衍。", "neglect; slight"],
  [/控え/, "临近...；以...为背景。", "ahead of; with upcoming"],
  [/踏まえ/, "基于...。", "based on"],
  [/振り出し/, "以...为起点。", "starting point"],
  [/を経て/, "经过...。", "through; via"],
  [/をもって|もちまして/, "以...；凭借...。", "with; by means of"],
  [/ものともせず/, "不把...当回事。", "undaunted by"],
  [/余儀なく/, "被迫...。", "be forced to"],
  [/よそに/, "不顾...。", "ignoring"],
  [/んがため/, "为了...。", "in order to"],
  [/んばかり/, "几乎要...似的。", "almost as if"],
  [/あげく/, "结果最后...，多为不理想结果。", "after all; in the end"],
  [/あまり/, "过于...以至于...。", "so much that"],
  [/以上|上は/, "既然...就...。", "now that; since"],
  [/得る|得ない/, "可能/不可能。", "can; cannot"],
  [/きっかけ|契機/, "以...为契机。", "as a trigger; opportunity"],
  [/かけ/, "刚开始做/做到一半。", "half-done; about to"],
  [/がち/, "容易...；常常...。", "tend to; prone to"],
  [/かねる/, "难以...。", "cannot; be unable to"],
  [/かねない/, "有可能发生坏结果。", "may well; could"],
  [/かのよう/, "好像...一样。", "as if"],
  [/からこそ/, "正因为...。", "precisely because"],
  [/からして/, "单从...来看。", "judging from"],
  [/からといって/, "虽说...也不能...。", "just because"],
  [/からには|からは/, "既然...就...。", "now that"],
  [/代わりに/, "代替；作为交换。", "instead of; in exchange"],
  [/気味/, "有点...倾向。", "a little; somewhat"],
  [/げ/, "看起来...的样子。", "seems; looks"],
  [/ことから/, "由...可知/因为...。", "from the fact that"],
  [/ことだから/, "因为是...，自然...。", "because it is"],
  [/ことなく/, "不...就...。", "without"],
  [/ことにはならない/, "并不等于...。", "does not mean"],
  [/際/, "在...之际。", "on the occasion of"],
  [/ざるを得ない/, "不得不...。", "cannot help but"],
  [/次第/, "一...就；取决于。", "as soon as; depending on"],
  [/ずにすむ|なくてすむ/, "不用...也可以。", "get by without"],
  [/ずにはいられない|ないではいられない/, "忍不住...。", "cannot help"],
  [/ばかりに/, "只因为...导致坏结果。", "just because"],
  [/だけあって|だけに/, "不愧是...；正因为...。", "as expected of; because"],
  [/たところだった|ところだった/, "差点...。", "almost; nearly"],
  [/ついでに/, "顺便...。", "while at it"],
  [/っこない/, "绝不可能...。", "no chance of"],
  [/つつある/, "正在逐渐...。", "be in the process of"],
  [/っぱなし/, "一直保持某状态不管。", "leave as is"],
  [/っぽい/, "有...倾向/像...。", "-ish; prone to"],
  [/てからでないと/, "不先...就不能...。", "unless after"],
  [/てでも/, "即使采用某手段也要...。", "even if by"],
  [/てはいられない/, "不能继续...下去。", "cannot afford to"],
  [/ではすまされない/, "不能就这样了事。", "cannot be settled by"],
  [/ということだ/, "据说/也就是说。", "it means; reportedly"],
  [/というものだ/, "这才算是...。", "that's what"],
  [/というものではない|というものでもない/, "并不是...。", "not necessarily"],
  [/というより/, "与其说...不如说...。", "rather than"],
  [/どころか/, "别说...，反而/甚至...。", "far from; let alone"],
  [/どころではない/, "不是...的时候。", "no time for"],
  [/としか言いようがない/, "只能说是...。", "can only be described as"],
  [/としたら|とすれば/, "如果...；既然...。", "if; assuming"],
  [/とともに/, "和...一起；随着...。", "together with; as"],
  [/とは限らない/, "不一定...。", "not necessarily"],
  [/ない限り/, "除非...否则...。", "unless"],
  [/ないことには/, "不...就不能...。", "unless"],
  [/ながら/, "一边...一边...；虽然...。", "while; although"],
  [/ならともかく/, "如果是...另说。", "it may be different if"],
  [/にあたって|にあたり/, "在...之际。", "when; on the occasion of"],
  [/に応じ/, "根据...。", "according to"],
  [/にかかわらず/, "不管...。", "regardless of"],
  [/に限って|に限り/, "只限于...；偏偏...。", "only; of all times"],
  [/に限らず/, "不限于...。", "not limited to"],
  [/に限る/, "最好...。", "the best is"],
  [/にかけて/, "在...方面；从...到...。", "when it comes to; over"],
  [/に決まっている/, "一定...。", "must be"],
  [/に加えて/, "加上...。", "in addition to"],
  [/に応えて/, "响应...。", "in response to"],
  [/に際して/, "在...之际。", "on the occasion of"],
  [/に先立ち|先立って/, "在...之前。", "prior to"],
  [/に従って/, "随着/按照...。", "as; according to"],
  [/にしたら|にすれば|にしても/, "从...立场看。", "from the standpoint of"],
  [/にしては/, "就...而言却...。", "considering"],
  [/にしろ|にせよ|にしても/, "即使/无论...。", "even if; whether"],
  [/に過ぎない/, "只不过...。", "nothing more than"],
  [/に相違ない|に違いない/, "一定...。", "must; no doubt"],
  [/に沿って/, "沿着/按照...。", "along; in line with"],
  [/につき/, "因为...；每...。", "because of; per"],
  [/につけ/, "每当...。", "whenever"],
  [/に伴い|に伴って/, "伴随...。", "along with"],
  [/に反し|に反して/, "与...相反/违反。", "contrary to"],
  [/にほかならない/, "正是...。", "nothing but"],
  [/にもかかわらず/, "尽管...。", "despite"],
  [/に基づき|に基づいて/, "基于...。", "based on"],
  [/にわたり|にわたって/, "跨越...范围/期间。", "over; throughout"],
  [/抜き/, "去掉...；没有...。", "without; excluding"],
  [/のもと/, "在...之下。", "under"],
  [/ばかりか/, "不但...而且...。", "not only"],
  [/ほか.*ない/, "除了...别无办法。", "nothing but"],
  [/まい/, "不会...；不要...。", "will not; must not"],
  [/ものか|もんか/, "绝不会...。", "as if; no way"],
  [/ものがある/, "有令人...的东西。", "there is something"],
  [/ものだから/, "因为...所以。", "because"],
  [/ものではない/, "不应该...。", "should not"],
  [/ものなら/, "如果能...的话。", "if one could"],
  [/ものの/, "虽然...但是...。", "although"],
  [/やら.*やら/, "又是...又是...。", "among other things"],
  [/ようでは/, "如果这样下去就...。", "if things are like"],
  [/ようなら|ようだったら/, "如果...的话。", "if"],
  [/わりに/, "虽然...但是相对地...。", "considering; for"],
  [/をかねて/, "兼作...。", "also serving as"],
  [/を中心/, "以...为中心。", "centered on"],
  [/を通じて|を通して/, "通过...；整个期间。", "through; throughout"],
  [/を問わず/, "不问...。", "regardless of"],
  [/を除き|を除いて/, "除...以外。", "except for"],
  [/をめぐり|をめぐって/, "围绕...。", "over; concerning"],
  [/をもとに/, "以...为基础。", "based on"],
  [/いただけませんか|願えませんか/, "能否请您...。", "could you please"],
  [/させていただく|ていただく/, "请允许我.../承蒙...。", "let me; have someone do"],
  [/ございます|でございます/, "「ある/です」的礼貌表达。", "polite form of aru/desu"],
  [/ください/, "请...。", "please"],
  [/ましょう/, "一起...吧/我来...吧。", "let's; shall I"],
  [/たい/, "想要...。", "want to"],
  [/ほしい/, "想要.../希望别人...。", "want; want someone to"],
  [/だろう|でしょう/, "大概...吧。", "probably"],
  [/かもしれない/, "也许...。", "might; may"],
  [/はず/, "按理应该...。", "should; expected to"],
  [/ようになる/, "变得会/开始...。", "come to"],
  [/ようにする/, "设法做到...。", "make sure to"],
  [/ため/, "为了/因为...。", "for; because"],
  [/いちばん/, "在某个范围内最...。", "the most; number one"],
  [/～(?:たら|なら|ば)|^もし|～と$/, "条件表达：如果/一...就。", "conditional"],
  [/ておく|とく/, "事先做；保持结果。", "do in advance; leave"],
  [/ていく/, "动作离说话人远去；持续变化。", "go on; away"],
  [/てくる/, "动作朝说话人而来；逐渐发生。", "come; start to"],
  [/てしまう|ちゃう/, "完成/不小心做了。", "finish; unfortunately"],
  [/てみる/, "试着...。", "try doing"],
  [/ている/, "正在/状态持续。", "be doing; state"],
  [/てある/, "结果状态已经准备好。", "has been done"],
  [/てもいい|てもかまわない/, "可以...。", "may; it is OK"],
  [/てはいけない/, "不可以...。", "must not"],
  [/なければならない|なくてはならない/, "必须...。", "must"],
  [/なくてもいい/, "不必...。", "do not have to"],
  [/すぎる/, "过于...。", "too much"],
  [/だす/, "开始...。", "start to"],
  [/つづける/, "继续...。", "continue"],
  [/やすい/, "容易...。", "easy to"],
  [/にくい/, "难以...。", "hard to"],
  [/方$/, "做法。", "way of doing"],
  [/さ$/, "程度/性质名词化。", "-ness"],
  [/ところ/, "正处于某个时间点/场面。", "at the point when"],
  [/ばかり/, "刚刚/净是。", "just; only"],
  [/ほど/, "程度；越...越...。", "extent; the more"],
  [/より/, "比...；从...。", "than; from"],
  [/まま/, "保持原样。", "as is"],
  [/疑問|誰|いつ|どう|なぜ|なんで|いくつ/, "疑问表达。", "question word"],
  [/^(?:～)?(?:が|を|に|で|と|から|まで|の|や|も|は)$/, "基础助词，用来标记句子关系。", "basic particle"]
];

function meaningFor(pattern) {
  for (const [regexp, zh, en] of grammarRules) {
    if (regexp.test(pattern)) return { zh, en };
  }
  return {
    zh: "这个文法点用于给句子补充条件、范围、语气或逻辑关系；学习时重点看接续和前后句关系。",
    en: "This grammar pattern adds condition, range, nuance, or logical relation; focus on connection and sentence flow."
  };
}

function formationFor(pattern, level) {
  if (/お\/ご|敬語|いただ|ください|ございます|なさる|申し上げる|存じ|拝見|参る|伺う/.test(pattern)) {
    return "敬语表达：常接动词ます形或汉语名词，用于请求、尊敬或自谦。";
  }
  if (/ない|ず|ぬ|ねば/.test(pattern)) return "多接动词ない形或否定表达；注意书面语和口语差别。";
  if (/て|で/.test(pattern)) return "多接动词て形、名词+で，连接前后动作或状态。";
  if (/～(?:ば|たら|なら)|^もし|～と$/.test(pattern)) return "条件表达：根据文型接普通形、た形、ば形或名词/形容词。";
  if (/に|を|から|まで|より|ほど|際|上|時|間/.test(pattern)) return "名词、动词普通形后常见；用来说明时间、范围、立场或依据。";
  if (level === "N5") return "基础句型：先掌握肯定/否定/过去式，再放进短句练习。";
  return "按文型接普通形、名词或形容词；先记典型搭配，再扩展到长句。";
}

function exampleFor(pattern) {
  const primary = firstVariant(pattern);
  const core = primary.replace(/^～/u, "");
  const normalized = pattern.replace(/\s+/g, "");

  if (/あっての/.test(normalized)) return ["家族の支えあっての成功だ。", "正因为有家人的支持，才有这次成功。", "This success was possible because of my family's support."];
  if (/以外の何ものでもない/.test(normalized)) return ["この結果は努力の成果以外の何ものでもない。", "这个结果完全就是努力的成果。", "This result is nothing other than the fruit of effort."];
  if (/いかん/.test(normalized)) return ["結果いかんで、次の方針を決める。", "根据结果来决定下一步方针。", "We will decide the next policy depending on the result."];
  if (/いざ/.test(normalized)) return ["いざ発表となると、急に緊張してきた。", "一到真正发表时，突然紧张起来了。", "When it actually came time to present, I suddenly got nervous."];
  if (/今ひとつ.*ない/.test(normalized)) return ["説明を聞いても、今ひとつ納得できない。", "即使听了说明，还是不太能接受。", "Even after hearing the explanation, I am not quite convinced."];
  if (/言わずもがな/.test(normalized)) return ["健康が大切なのは言わずもがなだ。", "健康很重要，这是不用说也知道的。", "It goes without saying that health is important."];
  if (/うにも.*ない/.test(normalized)) return ["鍵をなくして、部屋に入ろうにも入れない。", "钥匙丢了，想进房间也进不去。", "I lost the key, so I cannot enter the room even if I try."];
  if (/いちばん/.test(normalized)) return ["この町で駅前の店がいちばん便利だ。", "在这座城市里，车站前的店最方便。", "In this town, the shop in front of the station is the most convenient."];
  if (/あげく/.test(normalized)) return ["何度も迷ったあげく、留学を決めた。", "犹豫了很多次之后，最终决定留学。", "After hesitating many times, I finally decided to study abroad."];
  if (/あまり/.test(normalized)) return ["驚きのあまり、しばらく声が出なかった。", "因为太惊讶，一时说不出话。", "I was so surprised that I could not speak for a while."];
  if (/以上|上は/.test(normalized)) return ["約束した以上は、最後までやり遂げたい。", "既然约好了，就想做到最后。", "Since I promised, I want to see it through."];
  if (/ざるを得ない/.test(normalized)) return ["雨が強くなり、試合を中止せざるを得なかった。", "雨变大了，不得不中止比赛。", "The rain got heavy, so we had no choice but to cancel the match."];
  if (/ずにはいられない|ないではいられない/.test(normalized)) return ["その話を聞くと、笑わずにはいられない。", "听到那个故事就忍不住笑。", "When I hear that story, I cannot help laughing."];
  if (/ばかりに/.test(normalized)) return ["急いだばかりに、大事な資料を忘れた。", "就因为太着急，忘了重要资料。", "Just because I hurried, I forgot an important document."];
  if (/に応じ/.test(normalized)) return ["経験に応じて、担当する仕事が変わる。", "根据经验，负责的工作会变化。", "The assigned work changes according to experience."];
  if (/に基づ/.test(normalized)) return ["調査結果に基づいて、計画を見直した。", "基于调查结果，重新审视了计划。", "We reviewed the plan based on the survey results."];
  if (/にもかかわらず/.test(normalized)) return ["雨にもかかわらず、会場には多くの人が集まった。", "尽管下雨，会场还是来了很多人。", "Despite the rain, many people gathered at the venue."];
  if (/を通じ|を通して/.test(normalized)) return ["音楽を通じて、新しい友人ができた。", "通过音乐，交到了新朋友。", "Through music, I made new friends."];
  if (/を問わず/.test(normalized)) return ["年齢を問わず、この講座に参加できる。", "不问年龄，都可以参加这个讲座。", "Anyone can join this course regardless of age."];
  if (/をめぐ/.test(normalized)) return ["新しい制度をめぐって、議論が続いている。", "围绕新制度的讨论仍在继续。", "Discussions continue over the new system."];
  if (/ておく|とく/.test(normalized)) return ["出発前にチケットを買っておく。", "出发前先把票买好。", "I buy the ticket in advance before leaving."];
  if (/てしまう|ちゃう/.test(normalized)) return ["大切なメールを消してしまった。", "不小心删掉了重要邮件。", "I accidentally deleted an important email."];
  if (/たら/.test(normalized)) return ["時間があったら、図書館へ行く。", "如果有时间，就去图书馆。", "If I have time, I will go to the library."];
  if (/なら/.test(normalized)) return ["日本語を学ぶなら、毎日少しずつ読むといい。", "如果学日语，每天一点点阅读会比较好。", "If you study Japanese, it is good to read a little every day."];
  if (/ば/.test(normalized)) return ["練習すれば、発音は少しずつ自然になる。", "练习的话，发音会一点点自然起来。", "If you practice, your pronunciation will gradually become natural."];
  if (/てもいい|てもかまわない/.test(normalized)) return ["ここで写真を撮ってもいいです。", "可以在这里拍照。", "You may take photos here."];
  if (/てはいけない/.test(normalized)) return ["図書館で大きな声を出してはいけない。", "不能在图书馆大声说话。", "You must not speak loudly in the library."];
  if (/なければならない|なくてはならない/.test(normalized)) return ["明日までに申請書を出さなければならない。", "必须在明天之前提交申请书。", "I must submit the application by tomorrow."];
  if (/なくてもいい/.test(normalized)) return ["今日は制服を着なくてもいい。", "今天不穿制服也可以。", "You do not have to wear a uniform today."];
  if (/たい/.test(normalized)) return ["将来、日本で働きたい。", "将来想在日本工作。", "I want to work in Japan in the future."];
  if (/ほしい/.test(normalized)) return ["もう少し静かな部屋がほしい。", "想要再安静一点的房间。", "I want a quieter room."];
  if (/だろう|でしょう/.test(normalized)) return ["明日は晴れるでしょう。", "明天大概会晴。", "It will probably be sunny tomorrow."];
  if (/かもしれない/.test(normalized)) return ["午後から雨が降るかもしれない。", "下午可能会下雨。", "It may rain in the afternoon."];
  if (/はず/.test(normalized)) return ["彼はもう駅に着いているはずだ。", "他应该已经到车站了。", "He should have arrived at the station already."];
  if (/ようになる/.test(normalized)) return ["毎日聞いているうちに、少し聞き取れるようになった。", "每天听着听着，就渐渐能听懂一点了。", "By listening every day, I gradually became able to catch some of it."];
  if (/ようにする/.test(normalized)) return ["寝る前に復習するようにしている。", "我尽量睡前复习。", "I make sure to review before going to bed."];
  if (/ください/.test(normalized)) return ["この用紙に名前を書いてください。", "请在这张表上写名字。", "Please write your name on this form."];
  if (/ましょう/.test(normalized)) return ["休憩してから、もう一度確認しましょう。", "休息后再确认一次吧。", "Let's check again after taking a break."];
  if (/お\/ご|いただ|ございます|なさる|申し上げる|存じ|拝見|参る|伺う/.test(normalized)) return ["明日の予定を確認させていただきます。", "请允许我确认明天的安排。", "Please allow me to confirm tomorrow's schedule."];

  if (core.startsWith("に")) return [`状況${core}、判断が変わることがある。`, `根据“${core}”表达的关系，判断有时会改变。`, `Depending on the relation expressed by "${core}", the decision may change.`];
  if (core.startsWith("を")) return [`経験${core}、次の計画を立てた。`, `以经验为线索，制定了下一个计划。`, `I made the next plan using experience as the basis.`];
  if (core.startsWith("て") || core.startsWith("で")) return [`資料を確認し${core}、返事をした。`, `确认资料后，用这个文型连接动作并做出回复。`, `After checking the materials, I replied using this pattern to connect actions.`];
  if (core.startsWith("ない") || core.startsWith("ず")) return [`理由を聞か${core}、判断するのは難しい。`, `不听理由就判断很难。`, `It is hard to judge without hearing the reason.`];
  if (core.startsWith("ば")) return [`必要であれ${core}、早めに連絡してください。`, `如果有必要，请早点联系。`, `If necessary, please contact me early.`];
  return [`この文型「${primary}」を使って、理由や条件をはっきり示す。`, `用这个文型「${primary}」清楚表达理由或条件。`, `This pattern "${primary}" clearly shows a reason or condition.`];
}

function idFor(point) {
  const safe = point.pattern
    .normalize("NFKC")
    .replace(/[^ぁ-んァ-ンー一-龥々a-zA-Z0-9]/g, "")
    .slice(0, 28);
  return `grammar-${point.level.toLowerCase()}-${point.number}-${safe || "point"}`;
}

const rawPoints = extractEntries(parseOcr(inputPaths));
const points = rawPoints.map((point) => {
  const meaning = meaningFor(point.pattern);
  const example = exampleFor(point.pattern);
  return {
    id: idFor(point),
    level: point.level,
    number: point.number,
    pattern: point.pattern,
    titleZh: `${point.level} 文法 ${point.number}`,
    meaningZh: meaning.zh,
    meaningEn: meaning.en,
    formationZh: formationFor(point.pattern, point.level),
    exampleJp: example[0],
    exampleZh: example[1],
    exampleEn: example[2],
    source: "blue-book-grammar-pdf"
  };
});

const output = `// Generated from OCR of the user-provided Blue Book grammar PDF table of contents.\n// Explanations and examples are original study summaries adapted for this app.\nimport type { JLPTLevel } from "./studyContent";\n\nexport interface GrammarPoint {\n  id: string;\n  level: JLPTLevel;\n  number: number;\n  pattern: string;\n  titleZh: string;\n  meaningZh: string;\n  meaningEn: string;\n  formationZh: string;\n  exampleJp: string;\n  exampleZh: string;\n  exampleEn: string;\n  source: string;\n}\n\nexport const grammarSource = {\n  name: "蓝宝书大全集 新日本语能力考试N1-N5文法详解",\n  generatedAt: ${JSON.stringify(new Date().toISOString())},\n  count: ${points.length}\n};\n\nexport const grammarPoints: GrammarPoint[] = ${JSON.stringify(points, null, 2)};\n`;

fs.writeFileSync(outputPath, output);
console.log(`Generated ${points.length} grammar points from Blue Book OCR.`);

export interface RalColor {
  code: string;
  name: string;
  hex: string;
}

// RAL Classic — approximately 200 colors with hex approximations
// Useful for interior design color matching
export const RAL_CLASSIC: RalColor[] = [
  // RAL 1xxx — Yellows and Beiges
  { code: "RAL 1000", name: "Зеленовато-бежевый", hex: "#CCC58E" },
  { code: "RAL 1001", name: "Бежевый", hex: "#D2AA7B" },
  { code: "RAL 1002", name: "Песочный", hex: "#D2A050" },
  { code: "RAL 1003", name: "Сигнально-жёлтый", hex: "#F9A800" },
  { code: "RAL 1004", name: "Золотисто-жёлтый", hex: "#E49500" },
  { code: "RAL 1005", name: "Медово-жёлтый", hex: "#CB8E00" },
  { code: "RAL 1006", name: "Кукурузно-жёлтый", hex: "#E3A400" },
  { code: "RAL 1007", name: "Нарцисово-жёлтый", hex: "#E4A000" },
  { code: "RAL 1011", name: "Коричнево-бежевый", hex: "#AF8A54" },
  { code: "RAL 1012", name: "Лимонно-жёлтый", hex: "#D6AE01" },
  { code: "RAL 1013", name: "Жемчужно-белый", hex: "#EDE8D4" },
  { code: "RAL 1014", name: "Слоновая кость", hex: "#E3D49F" },
  { code: "RAL 1015", name: "Светло-слоновая кость", hex: "#EAE0C6" },
  { code: "RAL 1016", name: "Серно-жёлтый", hex: "#F5E700" },
  { code: "RAL 1017", name: "Шафраново-жёлтый", hex: "#FBAA2B" },
  { code: "RAL 1018", name: "Цинково-жёлтый", hex: "#F4E200" },
  { code: "RAL 1019", name: "Серо-бежевый", hex: "#B9A87E" },
  { code: "RAL 1020", name: "Оливково-жёлтый", hex: "#B5A042" },
  { code: "RAL 1021", name: "Кадмиево-жёлтый", hex: "#F4B800" },
  { code: "RAL 1023", name: "Транспортный жёлтый", hex: "#F7B500" },
  { code: "RAL 1024", name: "Охровый", hex: "#BE8E30" },
  { code: "RAL 1026", name: "Флуоресцентный жёлтый", hex: "#FFFF00" },
  { code: "RAL 1027", name: "Карри", hex: "#A88500" },
  { code: "RAL 1028", name: "Дынный жёлтый", hex: "#F4A829" },
  { code: "RAL 1032", name: "Жёлтый ракитник", hex: "#E2A100" },
  { code: "RAL 1033", name: "Жёлтая георгина", hex: "#F79500" },
  { code: "RAL 1034", name: "Пастельный жёлтый", hex: "#EBA443" },
  { code: "RAL 1037", name: "Солнечно-жёлтый", hex: "#F29300" },

  // RAL 2xxx — Oranges
  { code: "RAL 2000", name: "Жёлто-оранжевый", hex: "#DF6B00" },
  { code: "RAL 2001", name: "Красно-оранжевый", hex: "#BA3A2C" },
  { code: "RAL 2002", name: "Кроваво-оранжевый", hex: "#CD3C1B" },
  { code: "RAL 2003", name: "Пастельный оранжевый", hex: "#F57D36" },
  { code: "RAL 2004", name: "Чистый оранжевый", hex: "#F45A00" },
  { code: "RAL 2008", name: "Светло-красно-оранжевый", hex: "#F47131" },
  { code: "RAL 2009", name: "Транспортный оранжевый", hex: "#E55200" },
  { code: "RAL 2010", name: "Сигнальный оранжевый", hex: "#D75B2C" },
  { code: "RAL 2011", name: "Насыщенный оранжевый", hex: "#EC7C25" },
  { code: "RAL 2012", name: "Лососевый оранжевый", hex: "#D9785A" },

  // RAL 3xxx — Reds
  { code: "RAL 3000", name: "Огненно-красный", hex: "#A52019" },
  { code: "RAL 3001", name: "Сигнально-красный", hex: "#A02222" },
  { code: "RAL 3002", name: "Карминово-красный", hex: "#9E1A1A" },
  { code: "RAL 3003", name: "Рубиново-красный", hex: "#891611" },
  { code: "RAL 3004", name: "Пурпурно-красный", hex: "#6D0E0E" },
  { code: "RAL 3005", name: "Винно-красный", hex: "#5C1010" },
  { code: "RAL 3007", name: "Чёрно-красный", hex: "#3C1015" },
  { code: "RAL 3009", name: "Оксидно-красный", hex: "#6F3028" },
  { code: "RAL 3011", name: "Коричнево-красный", hex: "#732422" },
  { code: "RAL 3012", name: "Беженово-красный", hex: "#CF9281" },
  { code: "RAL 3013", name: "Томатно-красный", hex: "#9E271C" },
  { code: "RAL 3014", name: "Антично-розовый", hex: "#CF9281" },
  { code: "RAL 3015", name: "Светло-розовый", hex: "#D9A9A0" },
  { code: "RAL 3016", name: "Кораллово-красный", hex: "#A73C2B" },
  { code: "RAL 3017", name: "Розовый", hex: "#CA5454" },
  { code: "RAL 3018", name: "Клубнично-красный", hex: "#C32A32" },
  { code: "RAL 3020", name: "Транспортный красный", hex: "#BB1309" },
  { code: "RAL 3022", name: "Лососево-розовый", hex: "#D0584B" },
  { code: "RAL 3024", name: "Флуоресцентный красный", hex: "#FF3B00" },
  { code: "RAL 3026", name: "Флуоресцентный светло-красный", hex: "#FF4733" },
  { code: "RAL 3027", name: "Малиново-красный", hex: "#A8202D" },
  { code: "RAL 3028", name: "Чистый красный", hex: "#CC2C24" },
  { code: "RAL 3031", name: "Ориентально-красный", hex: "#A5291C" },

  // RAL 4xxx — Violets
  { code: "RAL 4001", name: "Красно-сиреневый", hex: "#8F7099" },
  { code: "RAL 4002", name: "Красно-фиолетовый", hex: "#8F3A50" },
  { code: "RAL 4003", name: "Вересковый фиолетовый", hex: "#C87198" },
  { code: "RAL 4004", name: "Бордово-фиолетовый", hex: "#6E2B50" },
  { code: "RAL 4005", name: "Голубовато-сиреневый", hex: "#8179A6" },
  { code: "RAL 4006", name: "Транспортный фиолетовый", hex: "#912F81" },
  { code: "RAL 4007", name: "Пурпурно-фиолетовый", hex: "#4F2D58" },
  { code: "RAL 4008", name: "Сигнально-фиолетовый", hex: "#8E5D87" },
  { code: "RAL 4009", name: "Пастельный фиолетовый", hex: "#A69598" },
  { code: "RAL 4010", name: "Телемагента", hex: "#C5447A" },

  // RAL 5xxx — Blues
  { code: "RAL 5000", name: "Фиолетово-синий", hex: "#3B5D87" },
  { code: "RAL 5001", name: "Зелёно-синий", hex: "#205F8A" },
  { code: "RAL 5002", name: "Ультрамариново-синий", hex: "#0D2472" },
  { code: "RAL 5003", name: "Сапфирово-синий", hex: "#1A3154" },
  { code: "RAL 5004", name: "Чёрно-синий", hex: "#141922" },
  { code: "RAL 5005", name: "Сигнально-синий", hex: "#1B4580" },
  { code: "RAL 5007", name: "Бриллиантово-синий", hex: "#3968A3" },
  { code: "RAL 5008", name: "Серо-синий", hex: "#293C54" },
  { code: "RAL 5009", name: "Лазурный синий", hex: "#2D6998" },
  { code: "RAL 5010", name: "Горечавково-синий", hex: "#115580" },
  { code: "RAL 5011", name: "Стальной синий", hex: "#1A2A38" },
  { code: "RAL 5012", name: "Голубой", hex: "#3E82B2" },
  { code: "RAL 5013", name: "Кобальтово-синий", hex: "#1A2E5C" },
  { code: "RAL 5014", name: "Голубино-синий", hex: "#607692" },
  { code: "RAL 5015", name: "Небесно-синий", hex: "#2A81B5" },
  { code: "RAL 5017", name: "Транспортный синий", hex: "#0B5EA8" },
  { code: "RAL 5018", name: "Бирюзово-синий", hex: "#22899A" },
  { code: "RAL 5019", name: "Капри-синий", hex: "#1A5D8A" },
  { code: "RAL 5020", name: "Океанически-синий", hex: "#0B4550" },
  { code: "RAL 5021", name: "Водяно-синий", hex: "#157590" },
  { code: "RAL 5022", name: "Ночной синий", hex: "#14213D" },
  { code: "RAL 5023", name: "Дистантный синий", hex: "#45678E" },
  { code: "RAL 5024", name: "Пастельный синий", hex: "#5B7FA6" },
  { code: "RAL 5025", name: "Перламутровый голубино-синий", hex: "#307BA0" },
  { code: "RAL 5026", name: "Перламутровый ночной синий", hex: "#0D1A2E" },

  // RAL 6xxx — Greens
  { code: "RAL 6000", name: "Патиново-зелёный", hex: "#3D7455" },
  { code: "RAL 6001", name: "Изумрудно-зелёный", hex: "#297048" },
  { code: "RAL 6002", name: "Лиственно-зелёный", hex: "#2B5B32" },
  { code: "RAL 6003", name: "Оливково-зелёный", hex: "#5E6B3B" },
  { code: "RAL 6004", name: "Синевато-зелёный", hex: "#174244" },
  { code: "RAL 6005", name: "Моховый зелёный", hex: "#254A3A" },
  { code: "RAL 6006", name: "Серо-оливковый", hex: "#373B2D" },
  { code: "RAL 6007", name: "Бутылочный зелёный", hex: "#2C3524" },
  { code: "RAL 6008", name: "Коричнево-зелёный", hex: "#343924" },
  { code: "RAL 6009", name: "Пихтовый зелёный", hex: "#264A37" },
  { code: "RAL 6010", name: "Травянисто-зелёный", hex: "#4C8332" },
  { code: "RAL 6011", name: "Резедовый зелёный", hex: "#638354" },
  { code: "RAL 6012", name: "Чёрно-зелёный", hex: "#2E3B35" },
  { code: "RAL 6013", name: "Тростниковый зелёный", hex: "#7E8968" },
  { code: "RAL 6014", name: "Жёлто-оливковый", hex: "#474937" },
  { code: "RAL 6015", name: "Чёрно-оливковый", hex: "#363C30" },
  { code: "RAL 6016", name: "Бирюзово-зелёный", hex: "#1A7C5B" },
  { code: "RAL 6017", name: "Майский зелёный", hex: "#4C8B38" },
  { code: "RAL 6018", name: "Жёлто-зелёный", hex: "#5EA03A" },
  { code: "RAL 6019", name: "Бело-зелёный", hex: "#B0CB97" },
  { code: "RAL 6020", name: "Хромово-зелёный", hex: "#2B3D29" },
  { code: "RAL 6021", name: "Бледно-зелёный", hex: "#7BAE72" },
  { code: "RAL 6022", name: "Оливково-коричневый", hex: "#4B4834" },
  { code: "RAL 6024", name: "Транспортный зелёный", hex: "#2A9B51" },
  { code: "RAL 6025", name: "Папоротниковый зелёный", hex: "#4D6B3D" },
  { code: "RAL 6026", name: "Опаловый зелёный", hex: "#126B59" },
  { code: "RAL 6027", name: "Светло-зелёный", hex: "#7FC6B7" },
  { code: "RAL 6028", name: "Сосновый зелёный", hex: "#305F42" },
  { code: "RAL 6029", name: "Мятный зелёный", hex: "#127A42" },
  { code: "RAL 6032", name: "Сигнальный зелёный", hex: "#247843" },
  { code: "RAL 6033", name: "Мятно-бирюзовый", hex: "#4C8C82" },
  { code: "RAL 6034", name: "Пастельный бирюзовый", hex: "#7DC4BE" },
  { code: "RAL 6035", name: "Жемчужно-зелёный", hex: "#1B5521" },
  { code: "RAL 6036", name: "Опаловый перламутрово-зелёный", hex: "#0F6B5E" },
  { code: "RAL 6037", name: "Чистый зелёный", hex: "#008B31" },
  { code: "RAL 6038", name: "Флуоресцентный зелёный", hex: "#00B72B" },

  // RAL 7xxx — Greys (critical for interiors)
  { code: "RAL 7000", name: "Беличий серый", hex: "#7C9AAE" },
  { code: "RAL 7001", name: "Серебристо-серый", hex: "#8A9BA8" },
  { code: "RAL 7002", name: "Оливково-серый", hex: "#817E62" },
  { code: "RAL 7003", name: "Мохово-серый", hex: "#747668" },
  { code: "RAL 7004", name: "Сигнально-серый", hex: "#9CA0A0" },
  { code: "RAL 7005", name: "Мышино-серый", hex: "#6A7178" },
  { code: "RAL 7006", name: "Бежево-серый", hex: "#716B5A" },
  { code: "RAL 7008", name: "Хаки-серый", hex: "#7B6E52" },
  { code: "RAL 7009", name: "Зелёно-серый", hex: "#616358" },
  { code: "RAL 7010", name: "Брезентово-серый", hex: "#5A5D5A" },
  { code: "RAL 7011", name: "Железно-серый", hex: "#4E5559" },
  { code: "RAL 7012", name: "Базальтово-серый", hex: "#555E64" },
  { code: "RAL 7013", name: "Коричнево-серый", hex: "#5A5249" },
  { code: "RAL 7015", name: "Сланцево-серый", hex: "#4E5157" },
  { code: "RAL 7016", name: "Антрацитово-серый", hex: "#353E42" },
  { code: "RAL 7021", name: "Чёрно-серый", hex: "#2A2E32" },
  { code: "RAL 7022", name: "Умбряно-серый", hex: "#4A4A4A" },
  { code: "RAL 7023", name: "Бетонно-серый", hex: "#7B7B7B" },
  { code: "RAL 7024", name: "Графитово-серый", hex: "#474B4E" },
  { code: "RAL 7026", name: "Гранитово-серый", hex: "#374448" },
  { code: "RAL 7030", name: "Каменно-серый", hex: "#8A8F8A" },
  { code: "RAL 7031", name: "Сине-серый", hex: "#5C6E77" },
  { code: "RAL 7032", name: "Галечно-серый", hex: "#B0AFA0" },
  { code: "RAL 7033", name: "Цементно-серый", hex: "#7F8878" },
  { code: "RAL 7034", name: "Жёлто-серый", hex: "#8E8970" },
  { code: "RAL 7035", name: "Светло-серый", hex: "#CBD4D5" },
  { code: "RAL 7036", name: "Платиново-серый", hex: "#908E84" },
  { code: "RAL 7037", name: "Пыльно-серый", hex: "#7A7A72" },
  { code: "RAL 7038", name: "Агатово-серый", hex: "#B0B2B2" },
  { code: "RAL 7039", name: "Кварцево-серый", hex: "#6A6860" },
  { code: "RAL 7040", name: "Оконно-серый", hex: "#9AA0AB" },
  { code: "RAL 7042", name: "Транспортный серый A", hex: "#8F9192" },
  { code: "RAL 7043", name: "Транспортный серый B", hex: "#4E5452" },
  { code: "RAL 7044", name: "Шелково-серый", hex: "#B1B0A7" },
  { code: "RAL 7045", name: "Телегрей 1", hex: "#8E9299" },
  { code: "RAL 7046", name: "Телегрей 2", hex: "#7A8086" },
  { code: "RAL 7047", name: "Телегрей 4", hex: "#C8C9C9" },
  { code: "RAL 7048", name: "Перламутровый мышино-серый", hex: "#817F72" },

  // RAL 8xxx — Browns (wood tones, natural materials)
  { code: "RAL 8000", name: "Зелёно-коричневый", hex: "#876B40" },
  { code: "RAL 8001", name: "Охристо-коричневый", hex: "#9A622C" },
  { code: "RAL 8002", name: "Сигнально-коричневый", hex: "#7B4737" },
  { code: "RAL 8003", name: "Глиняный коричневый", hex: "#7C4B24" },
  { code: "RAL 8004", name: "Медно-коричневый", hex: "#864532" },
  { code: "RAL 8007", name: "Олений коричневый", hex: "#7C4B28" },
  { code: "RAL 8008", name: "Оливково-коричневый", hex: "#7B4E26" },
  { code: "RAL 8010", name: "Тентовый коричневый", hex: "#6C3B1F" },
  { code: "RAL 8011", name: "Ореховый коричневый", hex: "#5A3018" },
  { code: "RAL 8012", name: "Красно-коричневый", hex: "#6B2E26" },
  { code: "RAL 8014", name: "Сепия-коричневый", hex: "#4A2F24" },
  { code: "RAL 8015", name: "Каштановый коричневый", hex: "#6B2C25" },
  { code: "RAL 8016", name: "Махагоново-коричневый", hex: "#4E2316" },
  { code: "RAL 8017", name: "Шоколадно-коричневый", hex: "#3E1F18" },
  { code: "RAL 8019", name: "Серо-коричневый", hex: "#3D2D26" },
  { code: "RAL 8022", name: "Чёрно-коричневый", hex: "#1A1011" },
  { code: "RAL 8023", name: "Оранжево-коричневый", hex: "#9A4D24" },
  { code: "RAL 8024", name: "Бежево-коричневый", hex: "#7B4C31" },
  { code: "RAL 8025", name: "Бледно-коричневый", hex: "#7B5B47" },
  { code: "RAL 8028", name: "Землисто-коричневый", hex: "#4C3024" },
  { code: "RAL 8029", name: "Перламутрово-медный", hex: "#7B3C2B" },

  // RAL 9xxx — Whites and Blacks (most used in interiors)
  { code: "RAL 9001", name: "Кремово-белый", hex: "#F4F0E0" },
  { code: "RAL 9002", name: "Серо-белый", hex: "#E5E3DB" },
  { code: "RAL 9003", name: "Сигнально-белый", hex: "#F4F4F4" },
  { code: "RAL 9004", name: "Сигнально-чёрный", hex: "#1E1E1E" },
  { code: "RAL 9005", name: "Глубокий чёрный", hex: "#0A0A0A" },
  { code: "RAL 9006", name: "Белый алюминий", hex: "#A0A3A0" },
  { code: "RAL 9007", name: "Серый алюминий", hex: "#878680" },
  { code: "RAL 9010", name: "Чистый белый", hex: "#F5F0E8" },
  { code: "RAL 9011", name: "Графитово-чёрный", hex: "#1A1B1E" },
  { code: "RAL 9012", name: "Чистый белый (2)", hex: "#F6F0E4" },
  { code: "RAL 9016", name: "Транспортный белый", hex: "#F6F4F4" },
  { code: "RAL 9017", name: "Транспортный чёрный", hex: "#1A1A1A" },
  { code: "RAL 9018", name: "Папирус-белый", hex: "#D4D8D1" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// Weighted Euclidean distance — better perceptual match than plain RGB
function colorDistance(
  [r1, g1, b1]: [number, number, number],
  [r2, g2, b2]: [number, number, number]
): number {
  return Math.sqrt(
    2 * (r1 - r2) ** 2 +
    4 * (g1 - g2) ** 2 +
    3 * (b1 - b2) ** 2
  );
}

export function findNearestRAL(hex: string): RalColor {
  const rgb = hexToRgb(hex);
  let nearest = RAL_CLASSIC[0];
  let minDist = Infinity;

  for (const color of RAL_CLASSIC) {
    const dist = colorDistance(rgb, hexToRgb(color.hex));
    if (dist < minDist) {
      minDist = dist;
      nearest = color;
    }
  }

  return nearest;
}

// Returns relative luminance (0 = black, 1 = white) for contrast decisions
export function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

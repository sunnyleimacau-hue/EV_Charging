import type { Language } from "./types";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh-Hant", label: "繁體中文" },
];

// UI labels only. Computed values (MOP amounts, times, SOC) are never translated.
const dict = {
  "app.title": { en: "Macau EV", "zh-Hant": "澳門電動車" },
  "app.tagline": {
    en: "where and when to charge",
    "zh-Hant": "何時何地充電",
  },

  "nav.decide": { en: "decide", "zh-Hant": "決定" },
  "nav.session": { en: "session", "zh-Hant": "充電中" },
  "nav.history": { en: "history", "zh-Hant": "紀錄" },
  "nav.predict": { en: "predict", "zh-Hant": "預測" },

  "common.save": { en: "save", "zh-Hant": "儲存" },
  "common.saved": { en: "saved", "zh-Hant": "已儲存" },
  "common.saving": { en: "saving", "zh-Hant": "儲存中" },
  "common.cancel": { en: "cancel", "zh-Hant": "取消" },
  "common.delete": { en: "delete", "zh-Hant": "刪除" },
  "common.close": { en: "close", "zh-Hant": "關閉" },
  "common.confirm": { en: "confirm", "zh-Hant": "確認" },
  "common.edit": { en: "edit", "zh-Hant": "編輯" },
  "common.add": { en: "add", "zh-Hant": "新增" },
  "common.retry": { en: "try again", "zh-Hant": "重試" },
  "common.ask": { en: "ask", "zh-Hant": "提問" },

  "login.heading": { en: "enter password", "zh-Hant": "輸入密碼" },
  "login.placeholder": { en: "shared password", "zh-Hant": "共用密碼" },
  "login.button": { en: "enter", "zh-Hant": "進入" },
  "login.error": { en: "wrong password", "zh-Hant": "密碼錯誤" },

  "settings.title": { en: "settings", "zh-Hant": "設定" },
  "settings.tariffs": { en: "tariffs (MOP/kWh)", "zh-Hant": "電價 (MOP/kWh)" },
  "settings.parking": { en: "parking and rent", "zh-Hant": "泊車與租金" },
  "settings.battery": { en: "battery", "zh-Hant": "電池" },
  "settings.usage": { en: "usage", "zh-Hant": "使用" },
  "settings.appearance": { en: "appearance", "zh-Hant": "外觀" },
  "settings.nioTariff": { en: "NIO charger", "zh-Hant": "NIO 充電" },
  "settings.slowDay": { en: "slow (day)", "zh-Hant": "慢充 (日)" },
  "settings.slowNight": { en: "slow (night)", "zh-Hant": "慢充 (夜)" },
  "settings.medium": { en: "medium", "zh-Hant": "中速" },
  "settings.quick": { en: "quick", "zh-Hant": "快充" },
  "settings.parkingDay": { en: "parking/hr (day)", "zh-Hant": "泊車/小時 (日)" },
  "settings.parkingNight": {
    en: "parking/hr (night)",
    "zh-Hant": "泊車/小時 (夜)",
  },
  "settings.homeRent": { en: "home rent/month", "zh-Hant": "住所租金/月" },
  "settings.capacity": { en: "capacity (kWh)", "zh-Hant": "容量 (kWh)" },
  "settings.chemistry": { en: "chemistry", "zh-Hant": "電池化學" },
  "settings.rmbToMop": { en: "RMB to MOP", "zh-Hant": "人民幣兌澳門幣" },
  "settings.dailyKwh": { en: "daily kWh estimate", "zh-Hant": "每日 kWh 估算" },
  "settings.wifeMode": { en: "wife mode by default", "zh-Hant": "預設簡易模式" },
  "settings.language": { en: "language", "zh-Hant": "語言" },
  "settings.theme": { en: "theme", "zh-Hant": "主題" },
  "settings.theme.light": { en: "light", "zh-Hant": "淺色" },
  "settings.theme.dark": { en: "dark", "zh-Hant": "深色" },
  "settings.theme.system": { en: "system", "zh-Hant": "系統" },
  "settings.signOut": { en: "sign out", "zh-Hant": "登出" },
  "settings.chargers": { en: "saved chargers", "zh-Hant": "已儲存充電站" },
  "settings.powers": { en: "charger power (kW)", "zh-Hant": "充電功率 (kW)" },
  "settings.nioPower": { en: "NIO charger", "zh-Hant": "NIO 充電" },
  "settings.slowPower": { en: "slow public", "zh-Hant": "慢充" },
  "settings.mediumPower": { en: "medium public", "zh-Hant": "中速" },
  "settings.quickPower": { en: "quick public", "zh-Hant": "快充" },
  "settings.cheapPremium": {
    en: "\"still cheap\" premium (x)",
    "zh-Hant": "「仍算便宜」倍數 (x)",
  },
  "settings.notes": { en: "charging context", "zh-Hant": "充電情境" },
  "settings.notesHint": {
    en: "free notes the assistant reads when deciding — e.g. when night public is worth it, habits, preferences",
    "zh-Hant": "助手決策時會參考的自由筆記，例如何時值得夜間公共充電、習慣、偏好",
  },
  "settings.notesPlaceholder": {
    en: "e.g. on nights with family parking, night public can be fine if we need a quick top-up",
    "zh-Hant": "例如：有家用車位的晚上，若需快速補電，夜間公共充電也可以",
  },

  "decide.currentSOC": { en: "current SOC", "zh-Hant": "目前電量" },
  "decide.targetSOC": { en: "target SOC", "zh-Hant": "目標電量" },
  "decide.toAdd": { en: "to add", "zh-Hant": "需充入" },
  "decide.night": { en: "night", "zh-Hant": "夜間" },
  "decide.day": { en: "day", "zh-Hant": "日間" },
  "decide.familyParking": {
    en: "family parking tonight",
    "zh-Hant": "今晚有家用車位",
  },
  "decide.parkingSunk": {
    en: "at destination (parking sunk)",
    "zh-Hant": "在目的地 (泊車已付)",
  },
  "decide.dwellPrimary": { en: "how long will you park?", "zh-Hant": "會停留多久？" },
  "decide.dwellAny": { en: "no limit", "zh-Hant": "不限" },
  "decide.hours": { en: "hours", "zh-Hant": "小時" },
  "decide.reaches": { en: "reaches", "zh-Hant": "可達" },
  "decide.target": { en: "target", "zh-Hant": "目標" },
  "decide.shortOfTarget": {
    en: "won't reach target in this time",
    "zh-Hant": "此時間內無法達標",
  },
  "decide.noTarget": { en: "no target — just charge cheaply", "zh-Hant": "無目標 — 只求便宜充電" },
  "decide.modeCheapest": { en: "cheapest energy", "zh-Hant": "最便宜電量" },
  "decide.modeMost": { en: "most charge (still cheap)", "zh-Hant": "最多電量 (仍便宜)" },
  "decide.adds": { en: "adds", "zh-Hant": "充入" },
  "decide.price": { en: "price per kWh", "zh-Hant": "每 kWh 價格" },
  "decide.power": { en: "power (kW)", "zh-Hant": "功率 (kW)" },
  "decide.zhuhaiNote": {
    en: "crossing to Zhuhai? charge there — cheapest by far",
    "zh-Hant": "要過關去珠海？在當地充電最便宜",
  },
  "decide.worthItTitle": {
    en: "is this charger worth it?",
    "zh-Hant": "這個充電站值得嗎？",
  },
  "decide.verdictBest": {
    en: "best value — cheapest that reaches your target",
    "zh-Hant": "最划算，達標選項中最便宜",
  },
  "decide.verdictCheaperThan": { en: "cheaper than", "zh-Hant": "比這個便宜：" },
  "decide.verdictPricierThan": { en: "pricier than", "zh-Hant": "比這個貴：" },
  "decide.simple": { en: "simple", "zh-Hant": "簡易" },
  "decide.detailed": { en: "detailed", "zh-Hant": "詳細" },
  "decide.simpleTagline": {
    en: "tell me your battery, I'll pick the spot",
    "zh-Hant": "告訴我電量，我來選地點",
  },
  "decide.easyChoice": { en: "the easy choice", "zh-Hant": "輕鬆之選" },
  "decide.tripDetails": { en: "trip details", "zh-Hant": "行程細節" },
  "decide.compareOptions": { en: "compare other options", "zh-Hant": "比較其他選項" },
  "decide.showAll": { en: "show all options", "zh-Hant": "顯示所有選項" },
  "decide.showBreakdown": { en: "show breakdown", "zh-Hant": "顯示明細" },
  "decide.startCharging": { en: "start charging", "zh-Hant": "開始充電" },
  "decide.chargeHere": { en: "charge here", "zh-Hant": "在此充電" },
  "decide.bestChoice": { en: "best choice", "zh-Hant": "最佳選擇" },
  "decide.askPlaceholder": {
    en: "ask anything about charging",
    "zh-Hant": "詢問任何充電問題",
  },
  "decide.energy": { en: "energy", "zh-Hant": "電費" },
  "decide.nightNote": {
    en: "usually pricier at night — NIO or daytime is often better",
    "zh-Hant": "夜間通常較貴，NIO 或日間多數更好",
  },

  "warn.target90": {
    en: "charging above 90% adds wear; fine occasionally",
    "zh-Hant": "充電超過 90% 會加速損耗，偶爾可以",
  },
  "warn.target100": {
    en: "100% is for long trips or LFP balancing only",
    "zh-Hant": "100% 只適用於長途或 LFP 平衡",
  },
  "warn.low": {
    en: "very low SOC — charge soon",
    "zh-Hant": "電量極低，請盡快充電",
  },

  "session.empty": {
    en: "no active session",
    "zh-Hant": "沒有進行中的充電",
  },
  "session.emptyHint": {
    en: "start one from the decide tab",
    "zh-Hant": "從決定頁開始充電",
  },
  "session.elapsed": { en: "elapsed", "zh-Hant": "已用時間" },
  "session.eta": { en: "remaining", "zh-Hant": "剩餘時間" },
  "session.estCost": { en: "cost so far", "zh-Hant": "目前費用" },
  "session.estTotal": { en: "estimated total", "zh-Hant": "預計總額" },
  "session.complete": { en: "complete", "zh-Hant": "完成" },
  "session.endSOC": { en: "actual end SOC", "zh-Hant": "實際結束電量" },
  "session.actualKwh": { en: "actual kWh (optional)", "zh-Hant": "實際 kWh (選填)" },
  "session.rate": { en: "rate this charger", "zh-Hant": "為充電站評分" },

  "history.totalSessions": { en: "sessions", "zh-Hant": "次數" },
  "history.totalSpent": { en: "spent", "zh-Hant": "花費" },
  "history.totalKwh": { en: "kWh", "zh-Hant": "kWh" },
  "history.avgRate": { en: "avg MOP/kWh", "zh-Hant": "平均 MOP/kWh" },
  "history.last30": { en: "last 30 days", "zh-Hant": "近 30 天" },
  "history.customRange": { en: "custom range", "zh-Hant": "自訂範圍" },
  "history.empty": { en: "no sessions yet", "zh-Hant": "尚無紀錄" },
  "history.notes": { en: "notes", "zh-Hant": "備註" },
  "history.monthly": { en: "monthly cost", "zh-Hant": "每月花費" },
  "history.savedVsIce": {
    en: "saved vs petrol this month",
    "zh-Hant": "本月較汽油節省",
  },
  "history.whyDifferent": {
    en: "why are costs different this month?",
    "zh-Hant": "為何本月費用不同？",
  },
  "history.estimated": { en: "estimated", "zh-Hant": "預估" },
  "history.actual": { en: "actual", "zh-Hant": "實際" },

  "predict.needMore": {
    en: "log at least 2 charges to see predictions",
    "zh-Hant": "需至少 2 次充電紀錄才能預測",
  },
  "predict.avgKwh": { en: "avg kWh per charge", "zh-Hant": "每次平均 kWh" },
  "predict.daysBetween": { en: "days between charges", "zh-Hant": "充電間隔天數" },
  "predict.dailyUse": { en: "implied daily use", "zh-Hant": "推算每日用量" },
  "predict.nextBy": { en: "next charge by", "zh-Hant": "下次充電期限" },
  "predict.daysLeft": { en: "days until 20%", "zh-Hant": "距 20% 天數" },
  "predict.zhuhaiHint": {
    en: "Zhuhai trip soon? wait and charge there",
    "zh-Hant": "即將前往珠海？可等到當地充電",
  },

  "chargers.add": { en: "add charger", "zh-Hant": "新增充電站" },
  "chargers.name": { en: "name", "zh-Hant": "名稱" },
  "chargers.type": { en: "type", "zh-Hant": "類型" },
  "chargers.location": { en: "location", "zh-Hant": "位置" },
  "chargers.walkMin": { en: "walking minutes", "zh-Hant": "步行分鐘" },
  "chargers.reliability": { en: "reliability", "zh-Hant": "可靠度" },
  "chargers.uses": { en: "uses", "zh-Hant": "次數" },
  "chargers.none": { en: "no saved chargers", "zh-Hant": "尚未儲存充電站" },

  "drift.banner": {
    en: "tariffs may have changed — review settings?",
    "zh-Hant": "電價可能已變動，是否檢視設定？",
  },
  "refine.title": { en: "suggested updates", "zh-Hant": "建議更新" },
  "refine.accept": { en: "accept", "zh-Hant": "接受" },
  "refine.reject": { en: "dismiss", "zh-Hant": "略過" },
  "refine.none": { en: "settings look accurate", "zh-Hant": "設定看來準確" },
} as const;

export type TranslationKey = keyof typeof dict;

export function t(key: TranslationKey, lang: Language): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}

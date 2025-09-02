// ===== App.jsx 完成版 (Part 1/3) =====
// そうえい専用 学習記録 — フル機能統合
// - 学習登録＋復習自動生成（当日/翌日/1週間後/1ヶ月後）
// - カードUI、ライト/ダーク、テーマカラー（zinc/blue/green）
// - 検索/フィルター（状態/科目/キーワード）
// - ダッシュボード（円グラフ／月別棒グラフ）
// - カレンダー（月表示）
// - ストリークトラッカー（連続日数）
// - 優先度（高/中/低）
// - 長期分析（月別 学習/復習/完了）
// - 成績入力＆推移グラフ
// - 実績（多数／時間帯条件なし）
// - ランキング（多指標）
// - バックアップ（JSON保存/復元、Driveは後で差し込み可）
// - 詳細モーダル（編集/削除/完了切替）

import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Flame,
  ClipboardList,
  LineChart, // lucide-react のアイコン
  Moon,
  Sun,
  Plus,
  Search,
  Settings as SettingsIcon,
  Trash2,
  Trophy,
  Star,
  Upload,
  Download,
  X,
  Info,
  Crown,
  Edit3,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart as RLineChart, // recharts の折れ線
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart as RPieChart, // recharts の円
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

// ===== ユーティリティ =====
const pad2 = (n) => n.toString().padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const toISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDaysISO = (iso, days) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const addMonthsISO = (iso, months) => {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + months);
  return toISO(d);
};
const cmpISO = (a, b) => (a === b ? 0 : a < b ? -1 : 1);
const isPastISO = (iso) => cmpISO(iso, todayStr()) < 0;
const uuid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// ===== ストレージ =====
const STORAGE_KEY = "soei-study-items";
const SETTINGS_KEY = "soei-study-settings";
const SCORES_KEY = "soei-study-scores";
const ACHIEVE_KEY = "soei-study-achievements";

const loadFromLS = (key, def) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : def;
  } catch {
    return def;
  }
};
const saveToLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ===== テーマ/スタイル =====
const THEME_BG = {
  zinc: "bg-zinc-50 dark:bg-zinc-900",
  blue: "bg-blue-50 dark:bg-blue-950",
  green: "bg-emerald-50 dark:bg-green-950",
};
const CARD_BG = "bg-white dark:bg-zinc-800";
const CARD_STYLE = `${CARD_BG} rounded-2xl shadow-md border border-zinc-200/70 dark:border-zinc-700/60`;
const INPUT_STYLE =
  "border rounded-lg p-2 w-full text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 bg-white dark:bg-zinc-800";
const SELECT_STYLE =
  "border rounded-lg p-2 w-full text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800";
const BTN_PRIMARY =
  "px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]";
const BTN_SECONDARY =
  "px-3 py-2 rounded-xl border hover:bg-zinc-50 dark:hover:bg-zinc-700";

// 優先度カラー
const PRIORITY_COLORS = {
  高: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  中: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  低: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
};

// ===== 実績（時間帯の条件は含めない） =====
const ACHIEVEMENTS = [
  { id: "first", name: "初めての登録", test: (items) => items.length >= 1 },
  { id: "first_review_done", name: "初めての復習完了", test: (items) =>
      items.some((x) => x.type === "復習" && x.status === "済") },
  { id: "ten_total", name: "総件数 10 達成", test: (items) => items.length >= 10 },
  { id: "twentyfive_total", name: "総件数 25 達成", test: (items) => items.length >= 25 },
  { id: "fifty_total", name: "総件数 50 達成", test: (items) => items.length >= 50 },
  { id: "hundred_total", name: "総件数 100 達成", test: (items) => items.length >= 100 },
  { id: "ten_reviews_done", name: "復習 完了10件", test: (items) =>
      items.filter((x) => x.type === "復習" && x.status === "済").length >= 10 },
  { id: "no_overdue_today", name: "今日までの期限超過ゼロ", test: (items) =>
      items.filter((x) => x.type === "復習" && x.status === "未" && isPastISO(x.dueDateISO)).length === 0 },
  { id: "streak_3", name: "連続 3 日", test: (items) => getCurrentStreak(items) >= 3 },
  { id: "streak_7", name: "連続 7 日", test: (items) => getCurrentStreak(items) >= 7 },
  { id: "streak_14", name: "連続 14 日", test: (items) => getCurrentStreak(items) >= 14 },
  { id: "subject_master", name: "科目 5 件以上（同一科目）", test: (items) => {
      const c = countBy(items, (x) => x.subject);
      return Object.values(c).some((n) => n >= 5);
    }},
  { id: "all_done_today", name: "今日の復習 全消化", test: (items) => {
      const t = todayStr();
      const due = items.filter((x) => x.type === "復習" && x.dueDateISO === t);
      return due.length > 0 && due.every((x) => x.status === "済");
    }},
];

// 補助: 連続日数
function getCurrentStreak(items) {
  const days = [
    ...new Set(items.filter((it) => it.status === "済").map((it) => it.dateISO)),
  ].sort();
  let streak = 0;
  let cur = todayStr();
  while (days.includes(cur)) {
    streak++;
    cur = addDaysISO(cur, -1);
  }
  return streak;
}

// 補助: 集計
function countBy(arr, fn) {
  return arr.reduce((acc, x) => {
    const k = fn(x);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

// ===== サブUI =====
function Section({ title, icon, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ItemCard({ it, onToggle, onDelete, onDetail }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`${CARD_STYLE} p-3 flex items-center justify-between`}
      style={{ opacity: it.status === "済" ? 0.6 : 1 }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs shrink-0 ${
              PRIORITY_COLORS[it.priority || "中"]
            }`}
          >
            {it.priority || "中"}
          </span>
          <div className="font-medium truncate">
            [{it.type}] {it.subject} {it.resource} {it.range}{" "}
            {it.stage ? `(${it.stage})` : ``}
          </div>
          {it.status === "済" && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          期日: {it.dueDateISO}／状態: {it.status}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onDetail(it)} title="詳細">
          <Info className="w-5 h-5 text-blue-500" />
        </button>
        <button onClick={() => onToggle(it)} title="完了/未">
          <CheckCircle className="w-5 h-5 text-green-600" />
        </button>
        <button onClick={() => onDelete(it.id)} title="削除">
          <Trash2 className="w-5 h-5 text-red-600" />
        </button>
      </div>
    </motion.div>
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className={`${CARD_STYLE} max-w-md w-full p-4 relative`}>
        <button
          className="absolute top-2 right-2"
          onClick={onClose}
          title="閉じる"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ===== メイン =====
export default function App() {
  // データ
  const [items, setItems] = useState(() => loadFromLS(STORAGE_KEY, []));
  const [settings, setSettings] = useState(() =>
    loadFromLS(SETTINGS_KEY, { dark: false, theme: "zinc" })
  );
  const [scores, setScores] = useState(() => loadFromLS(SCORES_KEY, []));
  const [achievements, setAchievements] = useState(() =>
    loadFromLS(ACHIEVE_KEY, [])
  ); // 必ず配列
const [rankings, setRankings] = useState([]);

useEffect(() => {
  const statsAll = {
    total: items.length,
    study: items.filter(it => it.type === "学習").length,
    review: items.filter(it => it.type === "復習").length,
    done: items.filter(it => it.status === "済").length,
  };

  const newRankings = [
    { name: "総タスク数", value: statsAll.total },
    { name: "学習登録数", value: statsAll.study },
    { name: "復習作成数", value: statsAll.review },
    { name: "完了数", value: statsAll.done },
  ];

  // 🔥 ここで前と同じなら更新しない
  setRankings(prev => {
    const prevStr = JSON.stringify(prev);
    const newStr = JSON.stringify(newRankings);
    return prevStr === newStr ? prev : newRankings;
  });

}, [items]);  // items が変わった時だけ実行
// 画面状態
const [tab, setTab] = useState("today"); 
 // today | add | all | dashboard | calendar | streak | analysis | scores | achieve | rank | backup | settings
  const [detail, setDetail] = useState(null); // modal item

  // 入力フォーム
  const [subject, setSubject] = useState("");
  const [resource, setResource] = useState("");
  const [range, setRange] = useState("");
  const [priority, setPriority] = useState("中");

  // 検索/フィルタ
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  // カレンダー
  const [monthISO, setMonthISO] = useState(todayStr().slice(0, 7)); // YYYY-MM

  // 保存
  useEffect(() => saveToLS(STORAGE_KEY, items), [items]);
  useEffect(() => saveToLS(SETTINGS_KEY, settings), [settings]);
  useEffect(() => saveToLS(SCORES_KEY, scores), [scores]);
  useEffect(() => saveToLS(ACHIEVE_KEY, achievements), [achievements]);
  useEffect(() => {
    // OS依存にせず、ユーザー設定だけで制御
    document.documentElement.classList.toggle("dark", settings.dark);
  }, [settings.dark]);
 // 実績の自動更新
useEffect(() => {
  const total = items.length;
  const done = items.filter(it => it.status === "済").length;

  const newAchievements = [];
  if (total >= 1) newAchievements.push("初めての登録");
  if (done >= 1) newAchievements.push("初めての完了");
  if (done >= 10) newAchievements.push("10回完了");
  if (done >= 50) newAchievements.push("50回完了");
  if (done >= 100) newAchievements.push("100回完了");

  setAchievements(newAchievements);
}, [items]);

// ランキングの自動更新
useEffect(() => {
  const counts = {};
  items.forEach(it => {
    if (it.subject) {
      counts[it.subject] = (counts[it.subject] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);

  setRankings(sorted);
}, [items]);

  // 実績チェック
  useEffect(() => {
    const owned = new Set(Array.isArray(achievements) ? achievements : []);
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (!owned.has(a.id) && a.test(items)) {
        owned.add(a.id);
        changed = true;
      }
    }
    if (changed) setAchievements(Array.from(owned));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const today = todayStr();

  // ソート
  const sorter = (a, b) => {
    const c1 = cmpISO(a.dueDateISO, b.dueDateISO);
    if (c1 !== 0) return c1;
    return a.subject.localeCompare(b.subject, "ja");
  };

  // 集計
  const dueToday = useMemo(
    () =>
      items
        .filter((it) => it.type === "復習" && it.dueDateISO === today)
        .sort(sorter),
    [items, today]
  );
  const overdue = useMemo(
    () =>
      items
        .filter(
          (it) => it.type === "復習" && it.status === "未" && isPastISO(it.dueDateISO)
        )
        .sort(sorter),
    [items]
  );

  const sevenDays = [...Array(7)].map((_, i) => addDaysISO(today, -6 + i));
  const dailyDone = sevenDays.map((iso) => ({
    day: iso.slice(5),
    完了:
      items.filter(
        (it) => it.type === "復習" && it.dueDateISO === iso && it.status === "済"
      ).length || 0,
    未了:
      items.filter(
        (it) => it.type === "復習" && it.dueDateISO === iso && it.status !== "済"
      ).length || 0,
  }));

  const byMonth = items.reduce((acc, it) => {
    const m = (it.dueDateISO || it.dateISO).slice(0, 7);
    if (!acc[m]) acc[m] = { month: m, 学習: 0, 復習: 0, 完了: 0 };
    acc[m][it.type] = (acc[m][it.type] || 0) + 1;
    if (it.status === "済") acc[m].完了++;
    return acc;
  }, {});
  const monthlyData = Object.values(byMonth).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const statsAll = {
    total: items.length,
    study: items.filter((x) => x.type === "学習").length,
    review: items.filter((x) => x.type === "復習").length,
    done: items.filter((x) => x.status === "済").length,
  };
  const pieData = [
    { name: "済", value: statsAll.done },
    { name: "未", value: statsAll.total - statsAll.done },
  ];

  // 追加・操作
  function addLearning() {
    if (!subject || !resource || !range) return;
    const dateISO = todayStr();
    const id = uuid();
    const base = {
      id,
      dateISO,
      dueDateISO: dateISO,
      type: "学習",
      stage: null,
      subject,
      resource,
      range,
      priority,
      status: "済",
    };
    const schedule = [
      { stage: "当日", plus: 0 },
      { stage: "翌日", plus: 1 },
      { stage: "1週間後", plus: 7 },
      { stage: "1ヶ月後", plus: 28 },
    ];
    const reviews = schedule.map(({ stage, plus }) => ({
      id: uuid(),
      dateISO,
      dueDateISO: addDaysISO(dateISO, plus),
      type: "復習",
      stage,
      subject,
      resource,
      range,
      priority,
      status: "未",
      parentId: id,
    }));
    setItems([...items, base, ...reviews]);
    setSubject("");
    setResource("");
    setRange("");
    setPriority("中");
    setTab("today");
  }

  function toggleStatus(it) {
    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id ? { ...x, status: x.status === "済" ? "未" : "済" } : x
      )
    );
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function deleteItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id && it.parentId !== id));
  }

  // ====== バックアップ（エクスポート & インポート） ======
  function backupData() {
    const data = {
      items,
      scores,
      settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "soei-study-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function restoreData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.items) setItems(data.items);
        if (data.scores) setScores(data.scores);
        if (data.settings) setSettings(data.settings);
        alert("バックアップを復元しました！");
      } catch (err) {
        alert("復元に失敗しました。ファイルが正しいか確認してください。");
      }
    };
    reader.readAsText(file);
  }

  // フィルタ適用
  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        if (filterStatus && it.status !== filterStatus) return false;
        if (filterSubject && it.subject !== filterSubject) return false;
        if (
          query &&
          !(
            (it.subject || "").includes(query) ||
            (it.resource || "").includes(query) ||
            (it.range || "").includes(query) ||
            (it.stage || "").includes(query)
          )
        )
          return false;
        return true;
      })
      .sort(sorter);
  }, [items, filterStatus, filterSubject, query]);

  // ランキング（自己内メトリクス）
  const subjectCount = countBy(items, (x) => x.subject || "（未入力）");
  const mostStudiedSubject =
    Object.entries(subjectCount).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "—";
  const currentStreak = getCurrentStreak(items);
  const longestStreak = (() => {
    // 簡易：完了日の連続ブロックの最大値
    const days = [
      ...new Set(items.filter((it) => it.status === "済").map((it) => it.dateISO)),
    ]
      .sort()
      .map((d) => d);
    let best = 0;
    let run = 0;
    let prev = null;
    for (const d of days) {
      if (!prev || d === addDaysISO(prev, 1)) {
        run++;
      } else {
        best = Math.max(best, run);
        run = 1;
      }
      prev = d;
    }
    best = Math.max(best, run);
    return best;
  })();

 

  // バックアップ
  function backupLocal() {
    const payload = {
      v: 1,
      exportedAt: new Date().toISOString(),
      items,
      settings,
      scores,
      achievements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-backup-${todayStr()}.json`;
    a.click();
  }
  function restoreLocal(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data.items)) setItems(data.items);
        if (data.settings && typeof data.settings === "object")
          setSettings((s) => ({ ...s, ...data.settings }));
        if (Array.isArray(data.scores)) setScores(data.scores);
        if (Array.isArray(data.achievements)) setAchievements(data.achievements);
        alert("復元しました。");
      } catch {
        alert("復元に失敗しました。ファイル形式を確認してください。");
      }
    };
    reader.readAsText(file);
  }

  // モーダル編集用
  const [editDraft, setEditDraft] = useState(null);
  useEffect(() => {
    if (detail) {
      setEditDraft({
        subject: detail.subject || "",
        resource: detail.resource || "",
        range: detail.range || "",
        priority: detail.priority || "中",
        dueDateISO: detail.dueDateISO || todayStr(),
      });
    } else {
      setEditDraft(null);
    }
  }, [detail]);

  // ====== UI（ヘッダー＆タブ）ここから（Part 2/3へ続く） =====
  return (
    <div className={`${THEME_BG[settings.theme]} min-h-[100dvh]`}>
      <div className="max-w-3xl mx-auto px-4 py-5">
        {/* ヘッダー */}
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Study Log</h1>
          <div className="flex items-center gap-2">
            {/* テーマ色 */}
            <div className="hidden sm:flex items-center gap-1 mr-1">
              {["zinc", "blue", "green"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                  className={`w-5 h-5 rounded-full border ${
                    settings.theme === t
                      ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
                      : "opacity-70"
                  } ${
                    t === "zinc"
                      ? "bg-zinc-300"
                      : t === "blue"
                      ? "bg-blue-500"
                      : "bg-emerald-500"
                  }`}
                  title={`テーマ: ${t}`}
                />
              ))}
            </div>
            {/* ダーク切替（OSに依存せず固定） */}
            <button
              onClick={() => setSettings((s) => ({ ...s, dark: !s.dark }))}
              className={`p-2 rounded-xl ${CARD_STYLE} flex items-center justify-center w-10 h-10`}
              title="ダーク/ライト切替"
            >
              {settings.dark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* タブ */}
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-2 border-b">
          {[
            { k: "today", l: "今日", icon: <Bell className="w-4 h-4" /> },
            { k: "add", l: "追加", icon: <Plus className="w-4 h-4" /> },
            { k: "all", l: "全件", icon: <Search className="w-4 h-4" /> },
            { k: "dashboard", l: "ダッシュボード", icon: <ClipboardList className="w-4 h-4" /> },
            { k: "calendar", l: "カレンダー", icon: <CalendarIcon className="w-4 h-4" /> },
            { k: "streak", l: "ストリーク", icon: <Flame className="w-4 h-4" /> },
            { k: "analysis", l: "分析", icon: <LineChart className="w-4 h-4" /> },
            { k: "scores", l: "成績", icon: <Trophy className="w-4 h-4" /> },
            { k: "achieve", l: "実績", icon: <Star className="w-4 h-4" /> },
            { k: "rank", l: "ランキング", icon: <Crown className="w-4 h-4" /> },
            { k: "backup", l: "バックアップ", icon: <Upload className="w-4 h-4" /> },
            { k: "settings", l: "設定", icon: <SettingsIcon className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl whitespace-nowrap ${
                tab === t.k
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : CARD_STYLE
              }`}
            >
              {t.icon}
              {t.l}
            </button>
          ))}
        </nav>

        {/* 本体 */}
        <main className="space-y-6">
          {tab === "today" && (
            <>
              <Section title="今日の復習" icon={<Bell />}>
                <AnimatePresence initial={false}>
                  {dueToday.length === 0 ? (
                    <p className="text-zinc-500">なし</p>
                  ) : (
                    dueToday.map((it) => (
                      <ItemCard
                        key={it.id}
                        it={it}
                        onToggle={toggleStatus}
                        onDelete={deleteItem}
                        onDetail={setDetail}
                      />
                    ))
                  )}
                </AnimatePresence>
              </Section>

              <Section title="期限超過" icon={<Clock />}>
                <AnimatePresence initial={false}>
                  {overdue.length === 0 ? (
                    <p className="text-zinc-500">なし</p>
                  ) : (
                    overdue.map((it) => (
                      <ItemCard
                        key={it.id}
                        it={it}
                        onToggle={toggleStatus}
                        onDelete={deleteItem}
                        onDetail={setDetail}
                      />
                    ))
                  )}
                </AnimatePresence>
              </Section>
            </>
          )}
{tab === "rank" && (
  <Section title="ランキング" icon={<Trophy />}>
    {rankings.length === 0 ? (
      <p className="text-zinc-500">まだランキングデータがありません</p>
    ) : (
      <ol className="space-y-2">
        {rankings.map((r, i) => (
          <li
            key={r.subject}
            className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-800 shadow"
          >
            <span className="font-bold">{i + 1}位</span>
            <span className="flex-1">{r.subject}</span>
            <span className="text-sm text-zinc-500">{r.count}回</span>
          </li>
        ))}
      </ol>
    )}
  </Section>
)}

{tab === "achieve" && (
  <Section title="実績" icon={<Trophy />}>
    <div className="grid gap-3 sm:grid-cols-2">
      {achievements.length === 0 ? (
        <p className="text-zinc-500">まだ実績はありません</p>
      ) : (
        achievements.map((a) => (
          <div
            key={a.id}
            className="p-3 rounded-xl bg-white dark:bg-zinc-800 shadow"
          >
            <div className="font-semibold">{a.name}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              {a.desc}
            </div>
          </div>
        ))
      )}
    </div>
  </Section>
)}

          {tab === "add" && (
            <Section title="学習追加" icon={<Plus />}>
              <div className={`${CARD_STYLE} p-3 grid grid-cols-1 sm:grid-cols-4 gap-3`}>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="科目"
                  className={INPUT_STYLE}
                />
                <input
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  placeholder="教材"
                  className={INPUT_STYLE}
                />
                <input
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="範囲"
                  className={INPUT_STYLE}
                />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={SELECT_STYLE}
                >
                  <option value="高">高</option>
                  <option value="中">中</option>
                  <option value="低">低</option>
                </select>
                <button
                  onClick={addLearning}
                  className="sm:col-span-4 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold"
                >
                  追加
                </button>
              </div>
            </Section>
          )}

          {tab === "all" && (
            <Section title="全データ" icon={<Search />}>
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  placeholder="検索（科目・教材・範囲・ステージ）"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={INPUT_STYLE}
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={SELECT_STYLE}
                >
                  <option value="">状態: 全て</option>
                  <option value="済">済</option>
                  <option value="未">未</option>
                </select>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className={SELECT_STYLE}
                >
                  <option value="">科目: 全て</option>
                  {[...new Set(items.map((it) => it.subject))].filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {filteredItems.length === 0 ? (
                <p className="text-zinc-500">一致するデータがありません</p>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((it) => (
                    <ItemCard
                      key={it.id}
                      it={it}
                      onToggle={toggleStatus}
                      onDelete={deleteItem}
                      onDetail={setDetail}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          {tab === "dashboard" && (
            <Section title="ダッシュボード" icon={<ClipboardList />}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className={`${CARD_STYLE} p-3`}>
                  <h3 className="font-semibold mb-2">進捗サマリー</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <RPieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label
                      >
                        <Cell fill="#22c55e" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </RPieChart>
                  </ResponsiveContainer>
                </div>
                <div className={`${CARD_STYLE} p-3`}>
                  <h3 className="font-semibold mb-2">7日間の復習数</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyDone}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="完了" fill="#3b82f6" />
                      <Bar dataKey="未了" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Section>
          )}

          {tab === "calendar" && (
            <Section title="カレンダー" icon={<CalendarIcon />}>
              <div className="flex justify-between items-center mb-2">
                <button
                  onClick={() => setMonthISO(addMonthsISO(monthISO + "-01", -1).slice(0, 7))}
                  className={BTN_SECONDARY}
                >
                  ◀
                </button>
                <div className="font-semibold">{monthISO}</div>
                <button
                  onClick={() => setMonthISO(addMonthsISO(monthISO + "-01", 1).slice(0, 7))}
                  className={BTN_SECONDARY}
                >
                  ▶
                </button>
              </div>
              {/* カレンダー描画 */}
              <div className="grid grid-cols-7 gap-1 text-sm">
                {["日","月","火","水","木","金","土"].map((w) => (
                  <div key={w} className="text-center font-semibold">{w}</div>
                ))}
                {(() => {
                  const d = parseISO(monthISO + "-01");
                  const year = d.getFullYear();
                  const month = d.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const startDay = firstDay.getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells = [];
                  for (let i = 0; i < startDay; i++) cells.push(null);
                  for (let day = 1; day <= daysInMonth; day++) {
                    const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
                    const dayItems = items.filter((it) => it.dueDateISO === iso);
                    cells.push({ d: day, iso, dayItems });
                  }
                  return cells.map((c, i) => (
                    <div key={i} className="h-20 border rounded-lg p-1 overflow-auto text-xs">
                      {c && (
                        <>
                          <div className="font-medium">{c.d}</div>
                          {c.dayItems.map((it) => (
                            <div key={it.id} className="truncate">
                              [{it.subject}] {it.stage || it.type}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </Section>
          )}

          {tab === "streak" && (
            <Section title="習慣トラッカー" icon={<Flame />}>
              <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200">
                🔥 連続勉強日数: {currentStreak}日
              </div>
            </Section>
          )}

          {tab === "analysis" && (
            <Section title="長期分析" icon={<LineChart />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="学習" fill="#3b82f6" />
                  <Bar dataKey="復習" fill="#f59e0b" />
                  <Bar dataKey="完了" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {tab === "scores" && (
            <Section title="成績管理" icon={<Trophy />}>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="科目"
                    className={INPUT_STYLE}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  <input
                    type="date"
                    className={INPUT_STYLE}
                    value={today}
                    onChange={(e) => {}}
                  />
                  <input
                    type="number"
                    placeholder="点数"
                    className={INPUT_STYLE}
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  />
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RLineChart data={[...scores].sort((a, b) => a.date.localeCompare(b.date))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="score" name="点数" />
                  </RLineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}
          {tab === "achievements" && (
            <Section title="実績一覧" icon={<Trophy />}>
              <div className="grid gap-3">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={`${CARD_STYLE} p-3 flex justify-between items-center`}
                  >
                    <div>
                      <div className="font-semibold">{a.title}</div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">{a.desc}</div>
                    </div>
                    <div>
                      {a.unlocked ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <span className="text-xs text-zinc-400">未達成</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {tab === "ranking" && (
            <Section title="ランキング" icon={<LineChart />}>
              <div className="grid gap-3">
                <div className={`${CARD_STYLE} p-3`}>
                  <h3 className="font-semibold mb-2">科目別 完了数ランキング</h3>
                  <ul className="list-decimal pl-6">
                    {ranking.subjects.map((r, i) => (
                      <li key={i}>
                        {r.subject}: {r.count}件
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${CARD_STYLE} p-3`}>
                  <h3 className="font-semibold mb-2">教材別 完了数ランキング</h3>
                  <ul className="list-decimal pl-6">
                    {ranking.resources.map((r, i) => (
                      <li key={i}>
                        {r.resource}: {r.count}件
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}

          {tab === "backup" && (
            <Section title="バックアップ" icon={<ClipboardList />}>
              <div className={`${CARD_STYLE} p-3 flex flex-col gap-2`}>
                <button
                  onClick={backupData}
                  className={BTN_PRIMARY}
                >
                  データをエクスポート
                </button>
                <input
                  type="file"
                  accept="application/json"
                  onChange={restoreData}
                  className="border rounded p-2"
                />
              </div>
            </Section>
          )}

          {tab === "settings" && (
            <Section title="設定" icon={<SettingsIcon />}>
              <div className={`${CARD_STYLE} p-3 space-y-3`}>
                <div>
                  <div className="font-medium mb-1">テーマカラー</div>
                  <div className="flex gap-2">
                    {["zinc", "blue", "green"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                        className={`px-3 py-1 rounded-lg border ${
                          settings.theme === t
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : ""
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-1">モード</div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, dark: !s.dark }))}
                    className={BTN_SECONDARY}
                  >
                    {settings.dark ? "ダーク" : "ライト"}
                  </button>
                </div>
              </div>
            </Section>
          )}
        </main>
      </div>

      {/* モーダル: 詳細表示 */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`${CARD_STYLE} p-5 max-w-md w-full`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h2 className="text-xl font-bold mb-2">詳細</h2>
              <p><b>科目:</b> {detail.subject}</p>
              <p><b>教材:</b> {detail.resource}</p>
              <p><b>範囲:</b> {detail.range}</p>
              <p><b>種類:</b> {detail.type}</p>
              <p><b>ステージ:</b> {detail.stage || "-"}</p>
              <p><b>期日:</b> {detail.dueDateISO}</p>
              <p><b>状態:</b> {detail.status}</p>
              <div className="mt-4 text-right">
                <button
                  onClick={() => setDetail(null)}
                  className={BTN_SECONDARY}
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

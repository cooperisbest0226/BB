"""
星座塔團隊 — 回歸測試
用法：
    python3 -m http.server 8791 --directory <專案資料夾> &
    python3 tests/test_app.py

每次改版後跑一次，確認舊功能沒被改壞。
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8791/index.html"
passed, failed = [], []


def check(name, got, want):
    if got == want:
        passed.append(name)
        print(f"  PASS  {name}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}\n        期望: {want}\n        實際: {got}")


def seed(page):
    """建立乾淨的測試資料：兩個成員、一天兩個 RUN。"""
    page.evaluate("""() => {
        localStorage.clear();
        state = seed();
        state.members.push({id:'m1',name:'小明',active:true});
        state.members.push({id:'m2',name:'小華',active:true});
        state.members.push({id:'m3',name:'小美',active:true});
        state.schedule['2026-08-01'] = [
            {id:'ptA', name:'RUN A1', time:'19:00', capacity:5,
             slots:[{memberId:'m1'}], drops:[{id:'d1',name:'威力隕石碎片',qty:3}]}
        ];
        state.schedule['2026-08-05'] = [
            {id:'ptB', name:'RUN B1', time:'21:00', capacity:10,
             slots:[{memberId:'m1'},{memberId:'m2'},{memberId:'m3'}], drops:[]}
        ];
        curDate = '2026-08-05';
        persist(); render();
    }""")
    page.wait_for_timeout(150)


def run(page):
    # ---------- 資料結構版本 ----------
    print("\n[schema] 資料結構版本遷移")
    seed(page)
    check("新資料帶有 schemaVersion",
          page.evaluate("() => state.schemaVersion"),
          page.evaluate("() => SCHEMA_VERSION"))
    check("舊資料（無 schemaVersion）會被遷移並補上版本號",
          page.evaluate("""() => {
              const old = {members:[],roles:[],schedule:{'2026-01-01':[{id:'x',name:'PT 3',slots:[]}]},};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [m.schemaVersion, m.schedule['2026-01-01'][0].name,
                      Array.isArray(m.sales), Array.isArray(m.schedule['2026-01-01'][0].drops)];
          }"""),
          [page.evaluate("() => SCHEMA_VERSION"), "RUN 3", True, True])
    check("資料版本比程式新時不強制轉換",
          page.evaluate("() => migrate({schemaVersion:999,members:[],roles:[],schedule:{}}).schemaVersion"),
          999)

    # ---------- 材料統計延後計算 ----------
    print("\n[perf] 材料統計延後計算")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(100)
    page.evaluate("() => { matDirty = false; }")
    page.evaluate("() => commit(()=>{ ptsOf(curDate)[0].slots.push({memberId:'m2'}); })")
    check("不在統計分頁時改排班只標記 dirty、不重算",
          page.evaluate("() => matDirty"), True)
    page.click('.tab[data-view="stats"]')
    page.wait_for_timeout(150)
    check("切到統計分頁後會補算", page.evaluate("() => matDirty"), False)

    # ---------- 陣容排序編輯器 ----------
    print("\n[order] 全螢幕排序編輯器")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(100)
    check("主板不顯示常駐便當按鈕", page.locator(".slot-bento").count(), 0)
    page.click('button[data-act="orderPt"]')
    page.wait_for_timeout(500)   # sheet 滑入動畫 340ms，等它停穩再量座標，否則量到動畫途中的位置
    check("排序編輯器為全螢幕",
          page.evaluate("() => !!document.querySelector('.sheet.sheet-full')"), True)

    grip = page.locator(".order-grip").nth(0)
    b1 = grip.bounding_box()
    row3 = page.locator(".order-row").nth(2)
    b3 = row3.bounding_box()
    page.mouse.move(b1["x"] + b1["width"] / 2, b1["y"] + b1["height"] / 2)
    page.mouse.down()
    page.mouse.move(b1["x"] + b1["width"] / 2, b1["y"] + b1["height"] / 2 + 10, steps=3)
    page.mouse.move(b3["x"] + b3["width"] / 2, b3["y"] + b3["height"] - 4, steps=10)
    page.mouse.up()
    page.wait_for_timeout(250)
    check("拖曳把手可一次移到任意位置",
          page.evaluate("() => state.schedule['2026-08-05'][0].slots.map(s=>memberById(s.memberId).name)"),
          ["小華", "小美", "小明"])

    page.click('.order-bento >> nth=0')
    page.wait_for_timeout(150)
    check("編輯模式可切換便當",
          page.evaluate("() => state.schedule['2026-08-05'][0].slots.map(s=>!!s.bento)"),
          [True, False, False])
    page.click("#orderDoneBtn")
    page.wait_for_timeout(200)

    # ---------- 售出計算 CRUD ----------
    print("\n[sales] 售出計算新增／編輯／刪除")
    seed(page)
    page.click('.tab[data-view="stats"]')
    page.wait_for_timeout(150)
    page.click('[data-sub="sales"]')
    page.wait_for_timeout(150)
    page.fill("#saleSets", "5")
    page.fill("#saleTwd", "100")
    page.fill("#saleRate", "2")
    page.click("#saleAdd")
    page.wait_for_timeout(200)
    check("新增交易", page.evaluate("() => state.sales.length"), 1)

    page.click(".salerow-edit")
    page.wait_for_timeout(200)
    page.fill('input[name="sets"]', "9")
    page.fill('input[name="twd"]', "150")
    page.click('[data-s="save"]')
    page.wait_for_timeout(200)
    check("編輯交易",
          page.evaluate("() => [state.sales[0].sets, state.sales[0].twd]"), [9, 150])

    page.click(".salerow-edit")
    page.wait_for_timeout(200)
    page.click('[data-s="del"]')
    page.wait_for_timeout(200)
    page.click('[data-s="yes"]')
    page.wait_for_timeout(200)
    check("刪除交易", page.evaluate("() => state.sales.length"), 0)

    # ---------- 新增日期複製指定來源 ----------
    print("\n[date] 新增日期可指定複製來源")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(100)
    page.click("#btnAddDate")
    page.wait_for_timeout(200)
    page.select_option('select[name="copyFrom"]', "2026-08-01")
    page.fill('input[name="d"]', "2026-08-10")
    page.click('[data-s="save"]')
    page.wait_for_timeout(250)
    check("複製的是選定日期而非最近日期",
          page.evaluate("() => state.schedule['2026-08-10'].map(p=>p.name)"), ["RUN A1"])
    check("掉落紀錄不跟著複製",
          page.evaluate("() => state.schedule['2026-08-10'][0].drops.length"), 0)

    # ---------- 刪除整天 ----------
    print("\n[date] 刪除整天排班")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(100)
    page.click("#btnDelDate")
    page.wait_for_timeout(200)
    page.click('[data-s="yes"]')
    page.wait_for_timeout(250)
    check("整天資料被刪除",
          page.evaluate("() => Object.keys(state.schedule).sort()"), ["2026-08-01"])

    seed(page)
    page.evaluate("() => { state.schedule = {'2026-08-05': state.schedule['2026-08-05']}; render(); }")
    page.click("#btnDelDate")
    page.wait_for_timeout(200)
    check("剩最後一天時拒絕刪除",
          page.evaluate("() => Object.keys(state.schedule).length"), 1)

    # ---------- 匯出日期區間 ----------
    print("\n[export] 匯出日期區間")
    seed(page)
    check("預設範圍只有目前這天",
          page.evaluate("() => exportDates(null,null)"), ["2026-08-05"])
    check("區間會篩出有資料的日期",
          page.evaluate("() => exportDates('2026-08-01','2026-08-31')"),
          ["2026-08-01", "2026-08-05"])
    check("區間外回傳空陣列",
          page.evaluate("() => exportDates('2026-09-01','2026-09-30')"), [])
    check("單天檔名戳記",
          page.evaluate("() => fileStamp(['2026-08-05'])"), "0805")
    check("多天檔名戳記",
          page.evaluate("() => fileStamp(['2026-08-01','2026-08-05'])"), "0801-0805")
    check("多天匯出節點含每日標題",
          page.evaluate("""() => {
              const n = buildExportNode(['2026-08-01','2026-08-05']);
              const days = n.querySelectorAll('.ex-day').length;
              document.getElementById('exportHost').innerHTML='';
              return days;
          }"""), 2)
    check("單天匯出節點不含每日標題",
          page.evaluate("""() => {
              const n = buildExportNode(['2026-08-05']);
              const days = n.querySelectorAll('.ex-day').length;
              document.getElementById('exportHost').innerHTML='';
              return days;
          }"""), 0)

    # ---------- 匯入前自動備份 ----------
    print("\n[backup] 匯入前自動備份")
    seed(page)
    check("backupJson 存在", page.evaluate("() => typeof backupJson"), "function")
    downloaded = []
    page.on("download", lambda d: downloaded.append(d.suggested_filename))
    page.evaluate("() => backupJson()")
    page.wait_for_timeout(400)
    check("備份檔名可辨識且帶時間戳",
          bool(downloaded) and downloaded[0].startswith("星座塔團隊_匯入前備份_"), True)

    # ---------- 手勢鎖定 ----------
    print("\n[gesture] 長按選字鎖定")
    check("全域禁止選字",
          page.evaluate("() => getComputedStyle(document.body).userSelect"), "none")
    check("輸入框仍可選字",
          page.evaluate("""() => {
              const i = document.createElement('input');
              document.body.appendChild(i);
              const v = getComputedStyle(i).userSelect;
              i.remove(); return v;
          }"""), "text")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 420, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    run(page)

    print(f"\n{'='*46}")
    print(f"通過 {len(passed)} 項，失敗 {len(failed)} 項")
    if errors:
        print("頁面錯誤:", errors)
    if failed:
        print("失敗項目:", failed)
    print(f"{'='*46}")
    browser.close()
    sys.exit(1 if (failed or errors) else 0)

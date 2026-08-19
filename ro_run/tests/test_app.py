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
    check("舊的交易紀錄會補上 mode='set' 與空的 items",
          page.evaluate("""() => {
              const old = {members:[],roles:[],schedule:{},
                           sales:[{id:'z',date:'2026-01-01',sets:3,twd:100,rate:2}]};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [m.sales[0].mode, Array.isArray(m.sales[0].items), m.sales[0].items.length,
                      m.sales[0].sets, m.sales[0].twd];
          }"""), ["set", True, 0, 3, 100])
    check("已經是單品的交易不會被改回整組",          page.evaluate("""() => {
              const old = {schemaVersion:2, members:[],roles:[],schedule:{},
                           sales:[{id:'z',date:'2026-01-01',mode:'item',rate:2,
                                   items:[{name:'威力隕石碎片',qty:5,twd:10}]}]};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [m.sales[0].mode, m.sales[0].items.length];
          }"""), ["item", 1])
    check("舊成員會補上空的 buffs，BUFF 顯示結果不變",
          page.evaluate("""() => {
              const old = {members:[{id:'a',name:'小明',defaultRoleId:'r1'}],
                           roles:[{id:'r1',name:'聖衛軍',buff:'天使之護',order:0}],
                           schedule:{}, sales:[]};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [typeof m.members[0].buffs, Object.keys(m.members[0].buffs).length];
          }"""), ["object", 0])

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

    # ---------- 分頁延後渲染 ----------
    print("\n[perf] 分頁延後渲染")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)
    check("render() 後只有目前分頁是乾淨的",
          page.evaluate("""() => {
              render();
              return VIEW_IDS.map(v => [v, viewDirty[v]]);
          }"""),
          [["board", False], ["calc", True], ["members", True],
           ["stats", True], ["auction", True]])
    check("在陣容分頁改資料不會重建成員列表的 DOM",
          page.evaluate("""() => {
              const host = document.getElementById('memberList');
              const before = host.firstElementChild;
              commit(()=>{ state.members[0].name = '改過的名字'; });
              return host.firstElementChild === before;   // 同一個節點 = 沒被重建
          }"""), True)
    check("切到成員分頁時才補畫，名字才更新",
          page.evaluate("""() => {
              document.querySelector('.tab[data-view="members"]').click();
              return document.querySelector('#memberList .row-t').textContent;
          }"""), "改過的名字")
    check("補畫後該分頁變乾淨",
          page.evaluate("() => viewDirty.members"), False)
    check("留在成員分頁改資料會立刻重畫",
          page.evaluate("""() => {
              commit(()=>{ state.members[0].name = '再改一次'; });
              return document.querySelector('#memberList .row-t').textContent;
          }"""), "再改一次")
    # ---------- 輸入框不被重繪打斷 ----------
    print("\n[perf] 重繪不打斷輸入")
    # 留在成員分頁做：隱藏中的元素 focus() 不會生效
    check("setInputValue 不動正在輸入的欄位",
          page.evaluate("""() => {
              const el = document.getElementById('memberSearch');
              el.focus(); el.value = '打到一半';
              setInputValue(el, '被蓋掉');
              const kept = el.value;
              el.blur();
              setInputValue(el, '沒在編輯就可以改');
              return [kept, el.value];
          }"""), ["打到一半", "沒在編輯就可以改"])
    check("值沒變時不重寫輸入框",
          page.evaluate("""() => {
              const el = document.getElementById('memberSearch');
              el.value = 'abc';
              let writes = 0;
              const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
              Object.defineProperty(el, 'value', {
                  get: () => d.get.call(el),
                  set: v => { writes++; d.set.call(el, v); },
                  configurable: true
              });
              setInputValue(el, 'abc');    // 一樣，不該寫
              setInputValue(el, 'xyz');    // 不一樣，該寫
              delete el.value;
              el.value = '';           // 清掉搜尋字串，否則後面的成員測試會被篩到空清單
              renderMembers();
              return writes;
          }"""), 1)

    page.click('.tab[data-view="auction"]')
    page.wait_for_timeout(300)
    page.click('#saleModeSeg [data-mode="item"]')
    page.wait_for_timeout(300)
    check("列數沒變時不重建明細列的 DOM",
          page.evaluate("""() => {
              const row = document.querySelector('#saleItemRows .itemrow');
              const input = row.querySelector('[data-f="name"]');
              renderSaleItemRows();          // 非強制：列數沒變
              return document.querySelector('#saleItemRows [data-f="name"]') === input;
          }"""), True)
    check("列數沒變時仍會更新小計",
          page.evaluate("""() => {
              saleDraftItems[0] = {name:'威力隕石碎片', qty:4, twd:25};
              renderSaleItemRows();
              return document.querySelector('.itemrow-s').textContent;
          }"""), "100")
    check("新增列會真的重建",
          page.evaluate("""() => {
              const input = document.querySelector('#saleItemRows [data-f="name"]');
              document.getElementById('saleItemAdd').click();
              return [document.querySelectorAll('#saleItemRows .itemrow').length,
                      document.querySelector('#saleItemRows [data-f="name"]') !== input];
          }"""), [2, True])
    page.evaluate("""() => {
        saleDraftItems = [{name:'', qty:'', twd:''}];   // 還原草稿，不要污染後面的拍賣測試
        renderSaleItemRows(true);
    }""")
    page.click('#saleModeSeg [data-mode="set"]')
    page.wait_for_timeout(200)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)

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
    print("\n[sales] 拍賣頁交易新增／編輯／刪除")
    seed(page)
    page.click('.tab[data-view="auction"]')
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

    # ---------- 拍賣：成交紀錄與走勢 ----------
    print("\n[auction] 成交紀錄分月 + 走勢")

    def load_sales(js):
        seed(page)
        page.evaluate("(rows) => { state.sales = rows; persist(); render(); }", js)
        page.click('.tab[data-view="auction"]')
        page.wait_for_timeout(350)

    load_sales([])
    check("沒有成交紀錄時顯示空狀態",
          page.evaluate("() => !!document.querySelector('#saleList .bench-empty')"), True)
    check("沒有成交紀錄時走勢區顯示提示，不畫圖",
          page.evaluate("""() => [!!document.querySelector('#saleTrend .bench-empty'),
                                  document.querySelectorAll('#saleTrend .spark').length]"""),
          [True, 0])

    load_sales([{"id": "a1", "date": "2026-08-05", "sets": 10, "twd": 100, "rate": 2}])
    check("只有一筆時不畫走勢圖",
          page.evaluate("() => document.querySelectorAll('#saleTrend .spark').length"), 0)
    check("只有一筆時仍列出該筆成交",
          page.evaluate("() => document.querySelectorAll('#saleList .auccard').length"), 1)

    six = [
        {"id": "b1", "date": "2026-05-12", "sets": 6,  "twd": 110, "rate": 2.1},
        {"id": "b2", "date": "2026-06-03", "sets": 10, "twd": 98,  "rate": 2.0},
        {"id": "b3", "date": "2026-06-21", "sets": 8,  "twd": 125, "rate": 2.2},
        {"id": "b4", "date": "2026-07-09", "sets": 12, "twd": 140, "rate": 2.15},
        {"id": "b5", "date": "2026-07-28", "sets": 5,  "twd": 132, "rate": 2.3},
        {"id": "b6", "date": "2026-08-05", "sets": 14, "twd": 155, "rate": 2.4},
    ]
    load_sales(six)
    check("成交紀錄依月份分成四堆",
          page.evaluate("() => document.querySelectorAll('#saleList .aucmon').length"), 4)
    check("月份由新到舊排列",
          page.evaluate("""() => [...document.querySelectorAll('.aucmon-t')].map(e=>e.textContent)"""),
          ["2026 年 8 月", "2026 年 7 月", "2026 年 6 月", "2026 年 5 月"])
    check("月份小結顯示筆數與組數",
          page.evaluate("""() => document.querySelectorAll('.aucmon-k')[1].textContent"""),
          "2 筆 · 17 組")
    check("月份小結金額為該月成交總額",
          page.evaluate("""() => document.querySelectorAll('.aucmon-v')[1].textContent"""),
          "2,340")
    check("同月份內新的成交在前",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .aucmon')[1]
              .querySelectorAll('.auc-lot')].map(e=>e.textContent)"""), ["#5", "#4"])
    check("每筆成交都有品項編號",
          page.evaluate("""() => [...document.querySelectorAll('.auc-lot')].map(e=>e.textContent)"""),
          ["#6", "#5", "#4", "#3", "#2", "#1"])
    check("成交卡片顯示組數／每組價／幣值",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .auccard')[0]
              .querySelectorAll('.auc-chip')].map(e=>e.textContent)"""),
          ["14 組", "每組 155", "幣值 2.4"])

    check("平均每組台幣用加權算（總台幣 ÷ 總組數）",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '平均每組台幣')
              .querySelector('.stat-v').textContent"""), "130")
    check("高於／低於均價的標記分別出現",
          page.evaluate("""() => [document.querySelectorAll('.auc-badge.up').length,
                                  document.querySelectorAll('.auc-badge.down').length]"""),
          [3, 3])
    check("最貴的那筆標成高於均價",
          page.evaluate("""() => document.querySelectorAll('#saleList .auccard')[0]
              .querySelector('.auc-badge').className.includes('up')"""), True)

    check("兩筆以上會畫出走勢折線",
          page.evaluate("() => document.querySelectorAll('#saleTrend .spark').length"), 1)
    check("折線的轉折點數等於成交筆數",
          page.evaluate("""() => document.querySelector('.spark-l')
              .getAttribute('d').split(/[ML]/).filter(Boolean).length"""), 6)
    check("走勢區顯示最高與最低成交價",
          page.evaluate("() => document.querySelector('.trend-hl').textContent"),
          "最高 155 · 最低 98"),
    check("月度長條每月一根",
          page.evaluate("() => document.querySelectorAll('.mbars .mbar').length"), 4)
    check("最高的月份長條為滿高",
          page.evaluate("""() => {
              const f = [...document.querySelectorAll('.mbar-fill')].map(e => parseFloat(e.style.height));
              return Math.max(...f);
          }"""), 100.0)

    # 超過六個月只留最近六個月
    many = [{"id": f"c{i}", "date": f"2026-{m:02d}-10", "sets": 5, "twd": 100 + i, "rate": 2}
            for i, m in enumerate(range(1, 9))]
    load_sales(many)
    check("月度長條最多只顯示近六個月",
          page.evaluate("() => document.querySelectorAll('.mbars .mbar').length"), 6)
    check("留下的是最新的六個月",
          page.evaluate("() => [...document.querySelectorAll('.mbar-l')].map(e=>e.textContent)"),
          ["3 月", "4 月", "5 月", "6 月", "7 月", "8 月"])

    # 編輯過日期的紀錄要照日期排，但品項編號沿用當初記錄的先後
    load_sales([
        {"id": "d1", "date": "2026-08-20", "sets": 5, "twd": 100, "rate": 2},
        {"id": "d2", "date": "2026-08-02", "sets": 5, "twd": 100, "rate": 2},
    ])
    check("日期被改過也照日期排序，編號不跟著跳動",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .auccard')].map(c => [
              c.querySelector('.auc-lot').textContent,
              c.querySelector('.auc-date').textContent.trim().split(' ')[0]
          ])"""), [["#1", "08/20"], ["#2", "08/02"]])

    # ---------- 拍賣：單品出售 ----------
    print("\n[auction] 單品出售與單品行情")
    mixed = [
        {"id": "m1", "date": "2026-06-03", "mode": "set", "sets": 10, "twd": 100, "rate": 2,
         "items": []},
        {"id": "m2", "date": "2026-07-09", "mode": "item", "sets": 0, "twd": 0, "rate": 2,
         "items": [{"name": "威力隕石碎片", "qty": 20, "twd": 10},
                   {"name": "耐力隕石浮塵", "qty": 10, "twd": 8}]},
        {"id": "m3", "date": "2026-08-05", "mode": "item", "sets": 0, "twd": 0, "rate": 2,
         "items": [{"name": "威力隕石碎片", "qty": 30, "twd": 20}]},
    ]
    load_sales(mixed)
    check("單品交易的總額為各列數量 × 單價相加",
          page.evaluate("() => [saleAmounts(state.sales[1]).twd, saleAmounts(state.sales[2]).twd]"),
          [280, 600])
    check("累計售出組數只算整組交易",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '累計售出組數')
              .querySelector('.stat-v').textContent"""), "10")
    check("累計售出單品只算單品交易",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '累計售出單品')
              .querySelector('.stat-v').textContent"""), "60")
    check("平均每組台幣不被單品交易稀釋",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '平均每組台幣')
              .querySelector('.stat-v').textContent"""), "100")
    check("單品交易的卡片標成單品，不比較每組均價",
          page.evaluate("""() => {
              const c = document.querySelectorAll('#saleList .auccard')[0];
              return [c.querySelector('.auc-badge').textContent,
                      c.querySelector('.auc-lot').classList.contains('item')];
          }"""), ["單品 1 項", True])
    check("單品卡片把每種材料列成標籤",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .auccard')[1]
              .querySelectorAll('.auc-chip')].map(e=>e.textContent)"""),
          ["威力隕石碎片 ×20 @10", "耐力隕石浮塵 ×10 @8", "幣值 2"])

    check("單品行情依材料統計，依成交額由大到小",
          page.evaluate("() => [...document.querySelectorAll('.quote-n')].map(e=>e.textContent)"),
          ["威力隕石碎片", "耐力隕石浮塵"])
    check("單品均價用加權算（總金額 ÷ 總數量）",
          page.evaluate("() => materialQuotes(state.sales).map(e => Math.round(e.avg*10)/10)"),
          [16, 8])
    check("單品行情記到最近一次成交價與日期",
          page.evaluate("""() => {
              const q = materialQuotes(state.sales)[0];
              return [q.lastUnit, q.lastDate, q.qty, q.n];
          }"""), [20, "2026-08-05", 50, 2])
    check("最近成交價高於均價時標成上漲",
          page.evaluate("""() => document.querySelector('.quote-p .auc-badge')
              .className.includes('up')"""), True)
    check("整組交易不會被算進單品行情",
          page.evaluate("""() => materialQuotes(state.sales.filter(s=>s.mode==='set')).length"""), 0)

    # 切到單品模式後可以新增／刪除明細列
    page.click('#saleModeSeg [data-mode="item"]')
    page.wait_for_timeout(250)
    check("切到單品模式會換掉輸入欄位",
          page.evaluate("""() => [document.getElementById('saleSetFields').hidden,
                                  document.getElementById('saleItemFields').hidden]"""),
          [True, False])
    check("切過去預設帶一列空明細",
          page.evaluate("() => document.querySelectorAll('#saleItemRows .itemrow').length"), 1)
    page.click("#saleItemAdd")
    page.wait_for_timeout(150)
    check("可以新增明細列",
          page.evaluate("() => document.querySelectorAll('#saleItemRows .itemrow').length"), 2)
    page.click('#saleItemRows .itemrow:nth-child(2) .salerow-x')
    page.wait_for_timeout(150)
    check("可以刪掉明細列",
          page.evaluate("() => document.querySelectorAll('#saleItemRows .itemrow').length"), 1)

    page.fill('#saleItemRows [data-f="name"]', "智慧隕石浮塵")
    page.fill('#saleItemRows [data-f="qty"]', "6")
    page.fill('#saleItemRows [data-f="twd"]', "25")
    page.wait_for_timeout(150)
    check("明細列即時算出小計",
          page.evaluate("() => document.querySelector('.itemrow-s').textContent"), "150")
    page.click("#saleAdd")
    page.wait_for_timeout(300)
    check("記錄單品交易會存成 mode='item'",
          page.evaluate("""() => {
              const s = state.sales[state.sales.length-1];
              return [s.mode, s.items.length, s.items[0].name, s.items[0].qty, s.items[0].twd];
          }"""), ["item", 1, "智慧隕石浮塵", 6, 25])
    check("記錄後明細列清空成一列空白",
          page.evaluate("""() => document.querySelectorAll('#saleItemRows .itemrow').length"""), 1)

    page.click('#saleModeSeg [data-mode="set"]')
    page.wait_for_timeout(200)
    check("每組台幣沿用上一筆整組交易，不會被單品交易的 0 蓋掉",
          page.evaluate("() => document.getElementById('saleTwd').value"), "100")

    # ---------- 拍賣：日期區間篩選 ----------
    print("\n[auction] 成交紀錄日期區間篩選")
    load_sales(mixed)
    check("預設不篩選，摘要顯示全部日期",
          page.evaluate("() => document.getElementById('aucFiltText').textContent"), "全部日期")
    check("未篩選時三筆都列出",
          page.evaluate("() => document.querySelectorAll('#saleList .auccard').length"), 3)

    page.click("#aucFiltBtn")
    page.wait_for_timeout(200)
    check("按篩選會展開條件區",
          page.evaluate("() => document.getElementById('aucFiltBody').hidden"), False)
    page.fill("#aucFrom", "2026-07-01")
    page.dispatch_event("#aucFrom", "change")
    page.wait_for_timeout(250)
    check("設定起日後只留該日之後的成交",
          page.evaluate("() => document.querySelectorAll('#saleList .auccard').length"), 2)
    page.fill("#aucTo", "2026-07-31")
    page.dispatch_event("#aucTo", "change")
    page.wait_for_timeout(250)
    check("加上迄日後只留區間內的成交",
          page.evaluate("() => [...document.querySelectorAll('.auc-lot')].map(e=>e.textContent)"),
          ["#2"])
    check("摘要顯示所選區間",
          page.evaluate("() => document.getElementById('aucFiltText').textContent"),
          "07/01 — 07/31")
    check("累計卡片跟著篩選走",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '累計總台幣')
              .querySelector('.stat-v').textContent"""), "280")
    check("單品行情也跟著篩選走",
          page.evaluate("() => [...document.querySelectorAll('.quote-n')].map(e=>e.textContent)"),
          ["威力隕石碎片", "耐力隕石浮塵"])
    check("區間內只有一筆時走勢圖不畫",
          page.evaluate("() => document.querySelectorAll('#saleTrend .spark').length"), 0)

    page.click('#aucFiltBody [data-aucpreset="all"]')
    page.wait_for_timeout(250)
    check("按全部會清掉區間",
          page.evaluate("""() => [document.getElementById('aucFiltText').textContent,
                                  document.querySelectorAll('#saleList .auccard').length]"""),
          ["全部日期", 3])

    page.fill("#aucFrom", "2026-01-01")
    page.dispatch_event("#aucFrom", "change")
    page.fill("#aucTo", "2026-01-31")
    page.dispatch_event("#aucTo", "change")
    page.wait_for_timeout(250)
    check("區間內沒有成交時顯示對應的空狀態",
          page.evaluate("() => document.querySelector('#saleList .bench-empty').textContent"),
          "這個日期區間沒有成交紀錄")
    page.click('#aucFiltBody [data-aucpreset="all"]')
    page.wait_for_timeout(200)

    # PT 計算的星數快捷鈕不該連動材料篩選
    page.click('.tab[data-view="calc"]')
    page.wait_for_timeout(150)
    page.evaluate("() => { matFrom='2026-08-01'; matTo='2026-08-31'; }")
    page.click('#view-calc [data-preset="0,5,5,3,5"]')
    page.wait_for_timeout(200)
    check("按 PT 快捷鈕不會把材料篩選重設掉",
          page.evaluate("() => [matFrom, matTo]"), ["2026-08-01", "2026-08-31"])
    check("PT 快捷鈕本身仍正常帶入星數",
          page.evaluate("() => ATTRS.map(a => stars[a.id])"), [0, 5, 5, 3, 5])
    page.evaluate("() => { matFrom=''; matTo=''; }")

    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)

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

    # ---------- 複製 RUN ----------
    print("\n[pt] 複製 RUN 會帶走陣容")
    seed(page)
    page.evaluate("""() => {
        const rid = state.roles[0].id;
        const p = state.schedule['2026-08-05'][0];
        p.slots = [{memberId:'m1', roleId:rid, bento:true},
                   {memberId:'m2', roleId:rid},
                   {memberId:'m3'}];
        p.drops = [{id:'d9', name:'威力隕石碎片', qty:2}];
        persist(); render();
    }""")
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(100)
    page.click('[data-act="dupPt"][data-pt="ptB"]')
    page.wait_for_timeout(250)
    check("複本會新增一個 RUN",
          page.evaluate("() => state.schedule['2026-08-05'].length"), 2)
    check("複本名稱加上「複本」",
          page.evaluate("() => state.schedule['2026-08-05'][1].name"), "RUN B1 複本")
    check("複本帶走全部成員",
          page.evaluate("() => state.schedule['2026-08-05'][1].slots.map(s=>s.memberId)"),
          ["m1", "m2", "m3"])
    check("複本保留職業指定",
          page.evaluate("""() => {
              const rid = state.roles[0].id;
              return state.schedule['2026-08-05'][1].slots.map(s => s.roleId === rid);
          }"""), [True, True, False])
    check("複本保留便當標記",
          page.evaluate("() => state.schedule['2026-08-05'][1].slots.map(s=>!!s.bento)"),
          [True, False, False])
    check("複本不帶掉落紀錄",
          page.evaluate("() => state.schedule['2026-08-05'][1].drops.length"), 0)
    check("複本的 id 與來源不同",
          page.evaluate("() => state.schedule['2026-08-05'][1].id !== 'ptB'"), True)
    check("複本人數顯示為 3/10",
          page.evaluate("""() => {
              const cards = [...document.querySelectorAll('.ptcard')];
              const c = cards[1] && cards[1].querySelector('.pt-count');
              return c ? c.textContent.replace(/\\s/g, '') : null;
          }"""), "3/10")
    check("複本畫面上列出三位成員",
          page.evaluate("""() => {
              const cards = [...document.querySelectorAll('.ptcard')];
              return cards[1]
                  ? [...cards[1].querySelectorAll('.slot-name')].map(e => e.textContent)
                  : null;
          }"""), ["小明", "小華", "小美"])
    check("複本與來源的 slots 各自獨立",
          page.evaluate("""() => {
              state.schedule['2026-08-05'][1].slots.splice(0, 1);
              return state.schedule['2026-08-05'][0].slots.length;
          }"""), 3)

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

    # ---------- 版面：底部懸浮分頁列 + 頂部成員列 ----------
    print("\n[layout] 底部分頁列與頂部成員列")
    seed(page)
    check("分頁列固定在底部",
          page.evaluate("() => getComputedStyle(document.querySelector('.tabbar')).position"),
          "fixed")
    check("分頁列位於畫面下半部",
          page.evaluate("""() => {
              const r = document.querySelector('.tabbar-glass').getBoundingClientRect();
              return r.top > innerHeight / 2;
          }"""), True)
    check("分頁列兩側留白（非滿版貼齊）",
          page.evaluate("""() => {
              const r = document.querySelector('.tabbar-glass').getBoundingClientRect();
              return r.left > 0 && r.right < innerWidth;
          }"""), True)
    check("分頁列有玻璃模糊效果",
          page.evaluate("""() => {
              const s = getComputedStyle(document.querySelector('.tabbar-glass'));
              return (s.backdropFilter || s.webkitBackdropFilter || '').includes('blur');
          }"""), True)
    check("五個分頁都有圖示",
          page.evaluate("() => document.querySelectorAll('.tabbar .tab svg').length"), 5)
    check("成員列位於頂部列內",
          page.evaluate("() => !!document.querySelector('.topbar .bench')"), True)
    check("成員列在分頁列上方",
          page.evaluate("""() => {
              const b = document.getElementById('bench').getBoundingClientRect();
              const t = document.querySelector('.tabbar-glass').getBoundingClientRect();
              return b.top < t.top;
          }"""), True)

    page.click('.tab[data-view="members"]')
    page.wait_for_timeout(200)
    check("非陣容分頁時成員列隱藏",
          page.evaluate("() => document.getElementById('bench').classList.contains('hidden')"), True)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(200)
    check("回到陣容分頁時成員列顯示",
          page.evaluate("() => document.getElementById('bench').classList.contains('hidden')"), False)

    # ---------- 分頁重整：成員含職業、材料與拍賣分家 ----------
    print("\n[nav] 分頁重整")
    seed(page)
    check("底部分頁共五個",
          page.evaluate("() => [...document.querySelectorAll('.tab')].map(t=>t.dataset.view)"),
          ["board", "calc", "members", "stats", "auction"])
    check("職業不再是獨立分頁",
          page.locator('.tab[data-view="roles"]').count(), 0)
    check("拍賣分頁標籤文字",
          page.evaluate("""() => document.querySelector('.tab[data-view="auction"] span').textContent"""),
          "拍賣")

    page.click('.tab[data-view="members"]')
    page.wait_for_timeout(200)
    check("成員頁有兩個子分頁，成員列表在前",
          page.evaluate("""() => [...document.querySelectorAll('#memberSeg [data-sub]')]
              .map(b => [b.dataset.sub, b.textContent])"""),
          [["mlist", "成員列表"], ["mroles", "職業設定"]])
    check("進入成員頁預設顯示成員列表",
          page.evaluate("""() => [document.getElementById('sub-mlist').classList.contains('active'),
                                  document.getElementById('sub-mroles').classList.contains('active')]"""),
          [True, False])
    check("成員搜尋框可用", page.locator("#memberSearch").is_visible(), True)

    page.click('#memberSeg [data-sub="mroles"]')
    page.wait_for_timeout(200)
    check("切到職業設定後顯示職業清單",
          page.evaluate("""() => [document.getElementById('sub-mlist').classList.contains('active'),
                                  document.getElementById('sub-mroles').classList.contains('active')]"""),
          [False, True])
    check("職業設定裡的新增職業鈕仍在",
          page.locator('#roleHeaderActions [data-act="addRole"]').count(), 1)
    check("職業清單有內容",
          page.evaluate("() => document.querySelectorAll('#roleList .row').length > 0"), True)

    # 切到材料頁再切回來，成員頁的子分頁不該被材料的子分頁切換影響
    page.click('.tab[data-view="stats"]')
    page.wait_for_timeout(150)
    check("材料頁子分頁只剩三個",
          page.evaluate("() => [...document.querySelectorAll('#matSeg [data-sub]')].map(b=>b.dataset.sub)"),
          ["totals", "sets", "detail"])
    check("售出計算已移出材料頁", page.locator('#matSeg [data-sub="sales"]').count(), 0)
    page.click('#matSeg [data-sub="sets"]')
    page.wait_for_timeout(200)
    check("材料子分頁切換不會關掉成員頁的子分頁",
          page.evaluate("() => document.getElementById('sub-mroles').classList.contains('active')"),
          True)
    check("材料子分頁本身有正常切換",
          page.evaluate("""() => [document.getElementById('sub-sets').classList.contains('active'),
                                  document.getElementById('sub-totals').classList.contains('active')]"""),
          [True, False])

    page.click('.tab[data-view="auction"]')
    page.wait_for_timeout(250)
    check("拍賣頁顯示售出試算欄位",
          page.evaluate("""() => ['saleSets','saleTwd','saleRate','saleAdd','saleList']
              .every(id => !!document.getElementById(id))"""), True)
    check("拍賣頁的售出區塊確實在拍賣分頁底下",
          page.evaluate("""() => !!document.getElementById('view-auction')
              .querySelector('#saleAdd')"""), True)
    check("切到拍賣頁時「帶入目前組數」有算出來",
          page.evaluate("""() => /帶入目前組數 \\d+/.test(
              document.getElementById('saleLoad').textContent)"""), True)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)

    # ---------- 成員個人 BUFF 覆蓋 ----------
    print("\n[buff] 成員 × 職業的 BUFF 覆蓋")
    seed(page)
    page.evaluate("""() => {
        const g = state.roles[1], k = state.roles[2];
        g.buff = '天使之護'; k.buff = '暗影披風';
        Object.assign(memberById('m1'), {defaultRoleId:g.id, buffs:{}});
        Object.assign(memberById('m2'), {defaultRoleId:g.id, buffs:{[g.id]:'聖體降臨'}});
        Object.assign(memberById('m3'), {defaultRoleId:k.id, buffs:{[k.id]:''}});
        const p = state.schedule['2026-08-05'][0];
        p.slots = [{memberId:'m1',roleId:g.id},{memberId:'m2',roleId:g.id},{memberId:'m3',roleId:k.id}];
        curDate = '2026-08-05'; persist(); render();
    }""")
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(300)

    check("沒設定覆蓋的人套用職業預設",
          page.evaluate("() => buffFor(memberById('m1'), state.roles[1])"), "天使之護")
    check("有設定覆蓋的人用自己的 BUFF",
          page.evaluate("() => buffFor(memberById('m2'), state.roles[1])"), "聖體降臨")
    check("覆蓋成空字串代表這個人不放 BUFF，不是回頭套預設",
          page.evaluate("() => buffFor(memberById('m3'), state.roles[2])"), "")
    check("覆蓋不會改到職業預設",
          page.evaluate("() => [state.roles[1].buff, state.roles[2].buff]"),
          ["天使之護", "暗影披風"])
    check("同職業的其他人不受影響",
          page.evaluate("""() => [buffFor(memberById('m1'), state.roles[1]),
                                  buffFor(memberById('m2'), state.roles[1])]"""),
          ["天使之護", "聖體降臨"])
    check("陣容格子顯示各自的 BUFF",
          page.evaluate("""() => [...document.querySelectorAll('.slot .slot-buff')]
              .map(e => e.textContent.trim())"""),
          ["天使之護", "聖體降臨", "＋ BUFF"])
    check("自訂的格子加上 own 標記，套預設的沒有",
          page.evaluate("""() => [...document.querySelectorAll('.slot .slot-buff')]
              .map(e => e.classList.contains('own'))"""),
          [False, True, True])

    # 從陣容格子點 BUFF 標籤修改
    page.click('.slot[data-si="0"] .slot-buff')
    page.wait_for_timeout(400)
    check("點格子的 BUFF 會開出該成員該職業的面板",
          page.evaluate("() => document.querySelector('.sheet-t, .sheet h3, .sheet-title')?.textContent || ''")
          .find("小明") >= 0, True)
    check("面板預先帶入目前生效的 BUFF",
          page.evaluate("""() => document.querySelector('.sheet [name="buff"]').value"""), "天使之護")
    check("沒有覆蓋時不顯示還原鈕",
          page.evaluate("""() => !!document.querySelector('.sheet [data-s="reset"]')"""), False)
    page.fill('.sheet [name="buff"]', "疾走、加速")
    page.click('.sheet [data-s="save"]')
    page.wait_for_timeout(400)
    check("儲存後只寫進該成員，職業預設不動",
          page.evaluate("""() => [memberById('m1').buffs[state.roles[1].id],
                                  state.roles[1].buff,
                                  buffFor(memberById('m2'), state.roles[1])]"""),
          ["疾走、加速", "天使之護", "聖體降臨"])
    check("格子立刻換成新的 BUFF 並標為自訂",
          page.evaluate("""() => {
              const e = document.querySelectorAll('.slot .slot-buff')[0];
              return [e.textContent.trim(), e.classList.contains('own')];
          }"""), ["疾走、加速", True])

    # 還原成職業預設
    page.click('.slot[data-si="0"] .slot-buff')
    page.wait_for_timeout(400)
    check("已有覆蓋時出現還原鈕",
          page.evaluate("""() => !!document.querySelector('.sheet [data-s="reset"]')"""), True)
    page.click('.sheet [data-s="reset"]')
    page.wait_for_timeout(400)
    check("還原後移除覆蓋，回頭套職業預設",
          page.evaluate("""() => [hasBuffOverride(memberById('m1'), state.roles[1].id),
                                  buffFor(memberById('m1'), state.roles[1])]"""),
          [False, "天使之護"])

    # 沒指定職業的格子不給設定
    page.evaluate("""() => {
        state.schedule['2026-08-05'][0].slots.push({memberId:'m1'});
        persist(); render();
    }""")
    page.wait_for_timeout(250)
    check("沒指定職業的格子不顯示 BUFF 標籤",
          page.evaluate("() => document.querySelectorAll('.slot .slot-buff').length"), 3)

    # 成員面板的 BUFF 列
    page.click('.tab[data-view="members"]')
    page.wait_for_timeout(250)
    page.click('#memberSeg [data-sub="mlist"]')   # 前面的測試可能停在「職業設定」子分頁
    page.wait_for_timeout(250)
    page.click('.row[data-id="m2"]')
    page.wait_for_timeout(400)
    check("成員面板列出該職業的 BUFF 與自訂標記",
          page.evaluate("""() => {
              const r = document.querySelector('.sheet .buffrow');
              return [r.querySelector('.buffrow-v').textContent,
                      r.querySelector('.buffrow-tag').textContent];
          }"""), ["聖體降臨", "自訂"])
    page.click('.sheet .buffrow')
    page.wait_for_timeout(400)
    check("從成員面板可以進到 BUFF 設定",
          page.evaluate("""() => document.querySelector('.sheet [name="buff"]').value"""), "聖體降臨")
    page.click('.sheet [data-s="cancel"]')
    page.wait_for_timeout(300)

    check("成員列表的摘要顯示生效後的 BUFF",
          page.evaluate("""() => document.querySelector('.row[data-id="m2"] .row-s').textContent"""),
          "帝國聖衛軍 · 聖體降臨")
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)

    # ---------- 復原／重做已移除 ----------
    print("\n[removed] 復原／重做已移除")
    check("復原鈕不存在", page.locator("#btnUndo").count(), 0)
    check("重做鈕不存在", page.locator("#btnRedo").count(), 0)
    check("undo/redo 函式不存在",
          page.evaluate("() => [typeof undo, typeof redo]"), ["undefined", "undefined"])
    check("commit 仍能正常存檔與重繪",
          page.evaluate("""() => {
              const before = ptsOf('2026-08-05')[0].slots.length;
              commit(()=>{ ptsOf('2026-08-05')[0].slots.push({memberId:'m2'}); });
              flushPersist();                       // 寫入已改為延遲合併，讀檔前先強制落盤
              const saved = JSON.parse(localStorage.getItem(KEY));
              return saved.schedule['2026-08-05'][0].slots.length === before + 1;
          }"""), True)

    # ---------- 資料安全：延遲寫入與自動快照 ----------
    print("\n[backup] 延遲寫入與自動備份快照")
    seed(page)
    page.evaluate("() => { flushPersist(); localStorage.setItem(KEY, JSON.stringify(state)); }")
    check("連續異動不會每次都寫 localStorage",
          page.evaluate("""() => {
              flushPersist();
              const before = localStorage.getItem(KEY);
              for (let i = 0; i < 5; i++) commit(()=>{ state.members[0].notes = 'n' + i; });
              const during = localStorage.getItem(KEY);   // 還在 debounce 視窗內，應該還是舊的
              return during === before;
          }"""), True)
    page.wait_for_timeout(400)
    check("停手後會自動落盤",
          page.evaluate("""() => JSON.parse(localStorage.getItem(KEY)).members[0].notes"""), "n4")
    check("flushPersist 可以立刻落盤",
          page.evaluate("""() => {
              commit(()=>{ state.members[0].notes = '立刻'; });
              flushPersist();
              return JSON.parse(localStorage.getItem(KEY)).members[0].notes;
          }"""), "立刻")

    # 快照
    page.evaluate("""async () => {
        const db = await snapDB();
        await new Promise(r => { const t = db.transaction('snapshots','readwrite');
            t.objectStore('snapshots').clear(); t.oncomplete = r; });
    }""")
    check("一開始沒有任何快照",
          page.evaluate("async () => (await listSnapshots()).length"), 0)
    check("可以建立快照並記下原因與版本",
          page.evaluate("""async () => {
              await saveSnapshot('daily');
              const rows = await listSnapshots();
              return [rows.length, rows[0].reason, rows[0].version, rows[0].size > 0];
          }"""), [1, "daily", page.evaluate("() => APP_VERSION"), True])
    check("快照存的是當下的完整資料",
          page.evaluate("""async () => {
              const rows = await listSnapshots();
              const snap = JSON.parse(rows[0].data);
              return [snap.members.length, Object.keys(snap.schedule).length];
          }"""), [3, 2])
    check("超過保留上限時丟掉最舊的",
          page.evaluate("""async () => {
              for (let i = 0; i < SNAP_KEEP + 3; i++) await saveSnapshot('daily');
              return (await listSnapshots()).length;
          }"""), page.evaluate("() => SNAP_KEEP"))
    check("快照由新到舊排列",
          page.evaluate("""async () => {
              const rows = await listSnapshots();
              return rows.every((r,i) => i === 0 || rows[i-1].id >= r.id);
          }"""), True)
    check("可以刪除單一快照",
          page.evaluate("""async () => {
              const rows = await listSnapshots();
              await deleteSnapshot(rows[0].id);
              const left = await listSnapshots();
              return [left.length, left.some(r => r.id === rows[0].id)];
          }"""), [page.evaluate("() => SNAP_KEEP") - 1, False])

    check("每天只自動建立一份快照",
          page.evaluate("""async () => {
              const db = await snapDB();
              await new Promise(r => { const t = db.transaction('snapshots','readwrite');
                  t.objectStore('snapshots').clear(); t.oncomplete = r; });
              delete state.settings.lastSnapDay;
              await autoSnapshot();
              const first = (await listSnapshots()).length;
              const second = await autoSnapshot();       // 同一天再呼叫應該被擋掉
              return [first, second, (await listSnapshots()).length, state.settings.lastSnapDay];
          }"""), [1, False, 1, page.evaluate("() => todayKey()")])

    check("還原快照會蓋掉目前資料",
          page.evaluate("""async () => {
              await saveSnapshot('daily');
              const rows = await listSnapshots();
              commit(()=>{ state.members = []; });
              const wiped = state.members.length;
              const data = JSON.parse(rows[0].data);
              curDate = null;
              commit(()=>{ state = migrate(data); });
              return [wiped, state.members.length];
          }"""), [0, 3])

    check("從沒匯出過時，備份提醒會顯示警告",
          page.evaluate("""() => {
              delete state.settings.lastExportAt;
              return [daysSinceExport(), backupNagHTML().includes('backupnag')];
          }"""), [None, True])
    check("剛匯出過就不顯示警告",
          page.evaluate("""() => {
              state.settings.lastExportAt = Date.now();
              return [daysSinceExport(), backupNagHTML().includes('backupnag')];
          }"""), [0, False])
    check("超過兩週沒匯出會重新提醒",
          page.evaluate("""() => {
              state.settings.lastExportAt = Date.now() - 20 * 86400000;
              return [daysSinceExport(), backupNagHTML().includes('backupnag')];
          }"""), [20, True])
    check("匯出 JSON 會記下時間",
          page.evaluate("""() => {
              delete state.settings.lastExportAt;
              const realDownload = window.download;
              window.download = () => {};              // 測試中不要真的觸發下載
              exportJson();
              window.download = realDownload;
              return typeof state.settings.lastExportAt;
          }"""), "number")

    # ---------- PWA：更新流程與離線資源 ----------
    print("\n[pwa] 更新提示與離線資源")
    seed(page)
    check("html2canvas 改為自帶，不再依賴 CDN",
          page.evaluate("""() => {
              const src = [...document.querySelectorAll('script[src]')].map(e => e.getAttribute('src'));
              return [src.some(u => u.includes('./vendor/html2canvas')),
                      src.some(u => u.includes('cdnjs.cloudflare.com'))];
          }"""), [True, False])
    check("html2canvas 實際載入成功",
          page.evaluate("() => typeof html2canvas"), "function")

    check("更新提示列預設不存在",
          page.evaluate("() => !!document.getElementById('updateBar')"), False)
    check("showUpdateBar 會顯示提示列與更新鈕",
          page.evaluate("""() => {
              showUpdateBar({postMessage(){}});
              const bar = document.getElementById('updateBar');
              return [!!bar, !!bar.querySelector('.updatebar-go'), bar.textContent.includes('新版本')];
          }"""), [True, True, True])
    check("重複呼叫不會疊出第二條",
          page.evaluate("""() => {
              showUpdateBar({postMessage(){}});
              return document.querySelectorAll('.updatebar').length;
          }"""), 1)
    check("按下立即更新會送出 SKIP_WAITING 並先落盤",
          page.evaluate("""() => {
              document.getElementById('updateBar').remove();
              let msg = null;
              showUpdateBar({postMessage(m){ msg = m; }});
              commit(()=>{ state.members[0].notes = '換版前'; });
              document.querySelector('.updatebar-go').click();
              const saved = JSON.parse(localStorage.getItem(KEY)).members[0].notes;
              return [msg && msg.type, saved];
          }"""), ["SKIP_WAITING", "換版前"])
    check("可以關掉提示列",
          page.evaluate("""() => {
              document.querySelector('.updatebar-x').click();
              return !!document.getElementById('updateBar');
          }"""), False)

    # ---------- 主程式拆檔 ----------
    print("\n[split] 主程式拆檔後的完整性")
    seed(page)
    check("index.html 不再有內嵌的主程式",
          page.evaluate("""() => {
              const inline = [...document.querySelectorAll('script:not([src])')];
              return inline.every(s => s.textContent.length < 2000);   // 只剩 head 那段防閃色的小程式
          }"""), True)
    check("主程式依固定順序載入 10 個檔案",
          page.evaluate("""() => [...document.querySelectorAll('script[src^="./js/"]')]
              .map(s => s.getAttribute('src').replace('./js/','').replace('.js',''))"""),
          ["data", "render", "materials", "auction", "assign",
           "sheets", "export", "events", "calc", "main"])
    check("拆檔後仍共用同一個全域範圍",
          page.evaluate("""() => {
              // 這幾個分別定義在不同檔案裡，彼此看得到才代表拆檔沒有切斷相依
              return [typeof state, typeof commit, typeof renderBoard,
                      typeof renderMaterials, typeof saleAmounts, typeof assign,
                      typeof sheet, typeof exportJson, typeof renderCalc];
          }"""), ["object"] + ["function"] * 8)
    check("跨檔案的常數也讀得到",
          page.evaluate("""() => [typeof APP_VERSION, typeof SCHEMA_VERSION,
                                  typeof SNAP_KEEP, typeof VIEW_IDS, typeof ATTRS]"""),
          ["string", "number", "number", "object", "object"])
    check("啟動流程有跑完（畫面已渲染、快照旗標已設）",
          page.evaluate("""() => [document.querySelectorAll('.datechip').length > 0,
                                  document.getElementById('brandSub').textContent.length > 0]"""),
          [True, True])
    check("Service Worker 會預先快取全部主程式檔案",
          page.evaluate("""async () => {
              const src = await (await fetch('./sw.js')).text();
              return ['data','render','materials','auction','assign',
                      'sheets','export','events','calc','main']
                  .every(n => src.includes(`./js/${n}.js`));
          }"""), True)

    # ---------- 切分頁的捲動位置與雙擊縮放 ----------
    print("\n[ux] 切分頁捲動位置與雙擊縮放")
    seed(page)
    # 塞夠多資料讓陣容頁可以往下捲
    page.evaluate("""() => {
        for (let i = 0; i < 12; i++)
            state.schedule['2026-08-05'].push({id:'sp'+i, name:'RUN '+i, time:'21:00',
                capacity:12, slots:[{memberId:'m1'}], drops:[]});
        persist(); render();
    }""")
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(300)
    page.evaluate("() => window.scrollTo(0, 600)")
    page.wait_for_timeout(250)
    check("陣容頁確實捲下去了", page.evaluate("() => window.scrollY > 300"), True)

    page.click('.tab[data-view="members"]')
    page.wait_for_timeout(450)
    check("切到成員分頁時回到最上面",
          page.evaluate("() => window.scrollY"), 0)
    check("成員分頁的子分頁按鈕在畫面內",
          page.evaluate("""() => {
              const r = document.getElementById('memberSeg').getBoundingClientRect();
              return r.top >= 0 && r.bottom <= window.innerHeight;
          }"""), True)

    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(450)
    check("切回陣容分頁會還原剛才的捲動位置",
          page.evaluate("() => window.scrollY > 300"), True)
    check("點目前這一頁不會清掉捲動位置",
          page.evaluate("""() => {
              const before = window.scrollY;
              document.querySelector('.tab[data-view="board"]').click();
              return window.scrollY === before;
          }"""), True)

    page.click('.tab[data-view="members"]')
    page.wait_for_timeout(400)
    page.evaluate("() => window.scrollTo(0, 200)")
    page.wait_for_timeout(200)
    page.click('#memberSeg [data-sub="mroles"]')
    page.wait_for_timeout(300)
    check("切子分頁會回到最上面",
          page.evaluate("() => window.scrollY"), 0)
    page.click('#memberSeg [data-sub="mlist"]')
    page.wait_for_timeout(250)

    check("body 停用雙擊放大但保留雙指縮放",
          page.evaluate("""() => getComputedStyle(document.body).touchAction"""), "manipulation")
    check("viewport 沒有鎖死縮放（無障礙）",
          page.evaluate("""() => {
              const c = document.querySelector('meta[name="viewport"]').content;
              return [c.includes('user-scalable=no'), c.includes('maximum-scale')];
          }"""), [False, False])
    check("待分配成員的橫向拖曳 touch-action 沒有被蓋掉",
          page.evaluate("""() => {
              const chip = document.querySelector('.bench-list .chip');
              return chip ? getComputedStyle(chip).touchAction : null;
          }"""), "pan-x")
    check("排序把手的 touch-action 沒有被蓋掉",
          page.evaluate("""() => {
              const el = document.createElement('div');
              el.className = 'order-grip';       // 排序編輯器的拖曳把手
              document.body.appendChild(el);
              const ta = getComputedStyle(el).touchAction;
              el.remove();
              return ta;
          }"""), "none")

    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(200)
    page.evaluate("() => window.scrollTo(0, 0)")

    # ---------- 掉落物數量輸入 ----------
    print("\n[drops] 掉落物數量輸入")
    seed(page)
    page.evaluate("() => { curDate = '2026-08-05'; render(); dropsSheet('ptB'); }")
    page.wait_for_timeout(400)
    check("列出預設的 14 種材料",
          page.evaluate("() => document.querySelectorAll('#dropRows .droprow').length"), 14)
    check("數量 0 時欄位留白，用 placeholder 提示",
          page.evaluate("""() => {
              const i = document.querySelector('#dropRows [data-qty]');
              return [i.value, i.placeholder];
          }"""), ["", "0"])
    check("數量 0 時減號是停用的",
          page.evaluate("""() => document.querySelector('#dropRows [data-step="-1"]').disabled"""), True)

    # 注意：.droprow 之間夾著系列標題 .dropgrp，:first-of-type 會落空，用實際名稱定位
    first = page.evaluate("() => document.querySelector('#dropRows .droprow').dataset.row")
    plus = f'[data-step="1"][data-m="{first}"]'
    minus = f'[data-step="-1"][data-m="{first}"]'
    qty = f'[data-qty="{first}"]'
    page.click(plus)
    page.wait_for_timeout(120)
    check("點一下加號只加 1",
          page.evaluate("() => document.querySelector('#dropRows [data-qty]').value"), "1")
    check("有數量後減號解除停用",
          page.evaluate("""() => document.querySelector('#dropRows [data-step="-1"]').disabled"""), False)

    # 按住不放：連續累加
    box = page.locator(plus).bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(1500)
    page.mouse.up()
    page.wait_for_timeout(150)
    held = int(page.evaluate("() => document.querySelector('#dropRows [data-qty]').value"))
    check("按住加號會連續累加", 5 < held < 40, True)
    check("放開後就停住",
          (lambda before: (page.wait_for_timeout(500),
                           int(page.evaluate("() => document.querySelector('#dropRows [data-qty]').value")) == before)[1])(held),
          True)

    # 按住減號一樣會連發，且不會掉到負數
    box = page.locator(minus).bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(2500)
    page.mouse.up()
    page.wait_for_timeout(200)
    check("按住減號會扣到 0 就停住，不會變負數",
          page.evaluate("""() => {
              const i = document.querySelector('#dropRows [data-qty]');
              return [i.value, document.querySelector('#dropRows [data-step="-1"]').disabled];
          }"""), ["", True])

    # 點數字直接打字取代，不用先刪掉原本的值
    page.click(plus)
    page.click(plus)
    page.wait_for_timeout(150)
    check("先累加到 2", page.evaluate("() => document.querySelector('#dropRows [data-qty]').value"), "2")
    page.click(qty)
    page.keyboard.type("8")
    page.wait_for_timeout(200)
    check("點數字後打字是取代不是接在後面",
          page.evaluate("() => document.querySelector('#dropRows [data-qty]').value"), "8")

    # 鍵盤操作不會被算成兩次
    page.evaluate("""() => {
        const b = document.querySelector('#dropRows .droprow [data-step="1"]');
        b.focus(); b.click();          // 鍵盤觸發只會發 click
    }""")
    page.wait_for_timeout(150)
    check("鍵盤觸發的 click 只算一次",
          page.evaluate("() => document.querySelector('#dropRows [data-qty]').value"), "9")

    # 打字之後再按加減：焦點還留在輸入框裡，畫面也必須跟著更新
    # （加減鈕會 preventDefault 以免長按選字，焦點不會自動離開輸入框）
    page.evaluate("() => { closeSheet(); }")
    page.wait_for_timeout(250)
    page.evaluate("() => dropsSheet('ptB')")
    page.wait_for_timeout(350)
    page.click(qty)
    page.keyboard.type("6")
    page.wait_for_timeout(150)
    page.click(plus)
    page.wait_for_timeout(200)
    check("打字後按加號，欄位數字會跟著更新（不會少 1）",
          page.evaluate(f"() => document.querySelector('{qty}').value"), "7")
    check("打字後按加號，欄位與摘要一致",
          page.evaluate("() => document.getElementById('dropSum').textContent.includes('共 7 個')"), True)
    check("這時焦點確實還在輸入框裡",
          page.evaluate(f"() => document.activeElement === document.querySelector('{qty}')"), True)
    page.click(minus)
    page.wait_for_timeout(200)
    check("打字後按減號也會同步更新",
          page.evaluate(f"() => document.querySelector('{qty}').value"), "6")
    page.click('.sheet [data-s="clear"]')
    page.wait_for_timeout(250)
    check("焦點在輸入框時按全部清空，欄位也會清掉",
          page.evaluate(f"() => document.querySelector('{qty}').value"), "")
    page.click(plus)
    page.click(plus)
    page.wait_for_timeout(200)

    check("摘要即時反映目前記錄",
          page.evaluate("() => document.getElementById('dropSum').textContent.includes('1 種')"), True)

    page.click('.sheet [data-s="save"]')
    page.wait_for_timeout(400)
    check("儲存後只寫入有數量的材料",
          page.evaluate("""() => ptsOf('2026-08-05')[0].drops.map(d => [d.name, d.qty])"""),
          [[first, 2]])

    # ---------- 組數試算的每列標示 ----------
    print("\n[sets] 組數試算的每列標示")
    seed(page)
    page.evaluate("""() => {
        const tot = {'威力隕石碎片':19,'耐力隕石碎片':7,'專注隕石碎片':21,'創造隕石碎片':38,
                     '咒數隕石碎片':20,'智慧隕石碎片':17,'威力隕石浮塵':35,'耐力隕石浮塵':15,
                     '專注隕石浮塵':28,'創造隕石浮塵':48,'咒數隕石浮塵':46,'智慧隕石浮塵':36};
        state.schedule['2026-08-05'][0].drops =
            Object.entries(tot).map(([n,q],i)=>({id:'sd'+i, name:n, qty:q}));
        matPerSet = 1; persist(); render();
    }""")
    page.click('.tab[data-view="stats"]')
    page.wait_for_timeout(250)
    page.click('#matSeg [data-sub="sets"]')
    page.wait_for_timeout(400)

    row = """(name) => {
        const r = [...document.querySelectorAll('.setrow')].find(x => x.textContent.includes(name));
        return [r.querySelector('.setrow-v').textContent, r.classList.contains('short')];
    }"""
    check("每種材料 1 個時，瓶頸材料決定可組成組數",
          page.evaluate("""() => document.querySelector('#matCards .mres-v').textContent.replace('組','')"""),
          "7")
    check("瓶頸材料寫「可組 N 組」，不再寫成「缺 N」",
          page.evaluate(row, "耐力隕石碎片"), ["7 · 可組 7 組再 1", True])
    check("瓶頸那列的組數與上方可組成組數一致",
          page.evaluate("""() => {
              const r = [...document.querySelectorAll('.setrow')].find(x => x.textContent.includes('耐力隕石碎片'));
              const own = +r.querySelector('.setrow-v').textContent.match(/可組 (\\d+) 組/)[1];
              const sets = +document.querySelector('#matCards .mres-v').textContent.replace('組','');
              return own === sets;
          }"""), True)
    check("非瓶頸材料照自己的數量算組數，且不標成瓶頸",
          page.evaluate(row, "創造隕石碎片"), ["38 · 可組 38 組", False])
    check("只有瓶頸材料才顯示「再 N」小標",
          page.evaluate("""() => {
              const tags = [...document.querySelectorAll('.setrow-v i')];
              return [tags.length, tags[0].textContent,
                      tags.every(t => t.closest('.setrow').classList.contains('short'))];
          }"""), [1, "再 1", True])

    # 每種 5 個時整體往下掉，標示要跟著改
    page.evaluate("() => { matPerSet = 5; renderMaterials(); }")
    page.wait_for_timeout(300)
    check("每種材料 5 個時可組成組數跟著改",
          page.evaluate("""() => document.querySelector('#matCards .mres-v').textContent.replace('組','')"""), "1")
    check("瓶頸材料 7 個、每組 5 個 → 可組 1 組，再 3 個進下一組",
          page.evaluate(row, "耐力隕石碎片"), ["7 · 可組 1 組再 3", True])
    check("數量足夠的材料不會被標成瓶頸",
          page.evaluate(row, "創造隕石浮塵"), ["48 · 可組 9 組", False])

    check("瓶頸的琥珀色用色票，深色模式不會變暗",
          page.evaluate("""() => {
              const before = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim();
              document.documentElement.dataset.theme = 'dark';
              const after = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim();
              delete document.documentElement.dataset.theme;
              return [before.length > 0, before !== after];
          }"""), [True, True])

    page.evaluate("() => { matPerSet = 5; }")
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)

    # ---------- 設定選單重做 ----------
    print("\n[settings] 設定選單重做")
    seed(page)
    check("settings 物件存在且有預設值",
          page.evaluate("""() => {
              const s = state.settings;
              return [s.theme, s.defaultTime, s.defaultCap];
          }"""), ["system", "20:00", 12])
    check("設定按鈕標題已改成「設定」",
          page.get_attribute("#btnMore", "title"), "設定")

    page.click("#btnMore")
    page.wait_for_timeout(250)
    check("職業篩選已移除", page.locator('select[name="rf"]').count(), 0)
    check("sheet 標題為「設定」", page.locator(".sheet-t").first.inner_text().strip(), "設定")
    check("設定列採分組列表呈現", page.locator(".settings-row").count() >= 6, True)

    page.click('[data-theme-v="dark"]')
    page.wait_for_timeout(200)
    check("切換深色後 state.settings.theme 更新",
          page.evaluate("() => state.settings.theme"), "dark")
    check("切換深色後 <html data-theme> 更新",
          page.evaluate("() => document.documentElement.dataset.theme"), "dark")
    check("深色模式下狀態列顏色跟著換",
          page.evaluate("() => document.querySelector('meta[name=theme-color]').content"), "#0d0f14")
    page.click('[data-theme-v="light"]')
    page.wait_for_timeout(200)
    check("切回淺色後狀態列顏色也換回來",
          page.evaluate("() => document.querySelector('meta[name=theme-color]').content"), "#eef1f7")

    page.fill('input[name="defTime"]', "21:30")
    page.dispatch_event('input[name="defTime"]', "change")
    page.fill('input[name="defCap"]', "6")
    page.dispatch_event('input[name="defCap"]', "change")
    page.wait_for_timeout(150)
    check("預設時間／人數上限已存到 settings",
          page.evaluate("() => [state.settings.defaultTime, state.settings.defaultCap]"),
          ["21:30", 6])
    page.evaluate("() => closeSheet()")
    page.wait_for_timeout(150)
    page.click('button:has-text("新增 RUN")')
    page.wait_for_timeout(200)
    check("新增 RUN 表單帶入新的預設時間",
          page.eval_on_selector('input[name="time"]', "el => el.value"), "21:30")
    check("新增 RUN 表單帶入新的預設人數上限",
          page.eval_on_selector('input[name="cap"]', "el => el.value"), "6")
    page.evaluate("() => closeSheet()")
    page.wait_for_timeout(150)

    page.click("#btnMore")
    page.wait_for_timeout(200)
    check("資料用量顯示公斤位數字",
          "KB" in page.locator(".settings-d").filter(has_text="KB").inner_text(), True)
    page.click('[data-s="changelog"]')
    page.wait_for_timeout(250)
    check("版本更新紀錄以時間軸呈現，至少有幾筆版本",
          page.locator("#sheetHost .cl-item").count() >= 5, True)
    check("每筆版本都有版本號與日期",
          page.evaluate("""() => {
              const items = [...document.querySelectorAll('.cl-item')];
              return items.every(i => i.querySelector('.cl-ver') && i.querySelector('.cl-date'));
          }"""), True)
    check("最新版標記為「目前版本」，且只有一個",
          page.locator("#sheetHost .cl-now-badge").count(), 1)
    check("第一筆就是最新版（帶 now 樣式）",
          page.evaluate("() => document.querySelector('.cl-item').classList.contains('now')"), True)
    check("變更項目有分類標籤",
          page.locator("#sheetHost .cl-tag").count() >= 5, True)
    check("標籤文字為中文分類而非代碼",
          page.evaluate("""() => {
              const tags = [...document.querySelectorAll('.cl-tag')].map(t => t.textContent);
              const valid = ['新增','修正','改善','變更','移除'];
              return tags.every(t => valid.includes(t));
          }"""), True)
    page.evaluate("() => closeSheet()")
    page.wait_for_timeout(150)

    # 清空所有資料
    page.click("#btnMore")
    page.wait_for_timeout(200)
    downloaded = []
    page.on("download", lambda d: downloaded.append(d.suggested_filename))
    page.click('[data-s="reset"]')
    page.wait_for_timeout(200)
    page.click('[data-s="yes"]')
    page.wait_for_timeout(300)
    check("清空後成員歸零", page.evaluate("() => state.members.length"), 0)
    check("清空後 settings 回到預設值",
          page.evaluate("() => state.settings"),
          {"theme": "system", "defaultTime": "20:00", "defaultCap": 12})
    check("清空前有自動下載備份", bool(downloaded), True)

    # ---------- 壓力測試修復 ----------
    print("\n[perf-fix] 日期列不再整條重繪、指派人員不再跳頁")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(100)
    page.evaluate("""() => {
        const r0 = state.roles[0].id;
        for (let i=0;i<8;i++) state.members.push({id:'x'+i,name:'測試員'+i,active:true,defaultRoleId:r0});
        ptsOf(curDate)[0].capacity = 12;
        persist(); render();
    }""")
    page.evaluate("() => window.scrollTo(0, 300)")
    page.wait_for_timeout(150)
    before_scroll = page.evaluate("() => window.scrollY")
    page.evaluate("() => assign(state.members[state.members.length-1].id, ptsOf(curDate)[0].id)")
    page.wait_for_timeout(200)
    after_scroll = page.evaluate("() => window.scrollY")
    check("指派人員後頁面垂直捲動位置不變", after_scroll, before_scroll)

    check("日期集合沒變時 renderDates 不整條重建（沿用既有 DOM 節點）",
          page.evaluate("""() => {
              const rail = document.getElementById('dateRail');
              const nodeBefore = rail.querySelector('.datechip');
              renderDates();
              return rail.querySelector('.datechip') === nodeBefore;
          }"""), True)

    # ---------- 存檔失敗仍要能優雅處理（警示列功能已依需求拿掉，但底層防護還是要在） ----------
    print("\n[storage-fallback] 存檔失敗不會讓 App 掛掉")
    seed(page)
    check("警示列相關元素已經拿掉", page.locator("#storageBanner").count(), 0)
    page.evaluate("""() => {
        window.__origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k,v){ if(k===KEY) throw new DOMException('quota','QuotaExceededError'); return window.__origSetItem.call(this,k,v); };
    }""")
    result = page.evaluate("""() => {
        let threw = false;
        try { commit(()=>{ ptsOf(curDate)[0].capacity += 1; }); } catch(e) { threw = true; }
        return {threw, appAlive: typeof render === 'function'};
    }""")
    check("存檔失敗時 commit() 不會拋出未捕捉例外", result["threw"], False)
    check("存檔失敗後 App 仍正常運作", result["appAlive"], True)
    page.evaluate("() => { Storage.prototype.setItem = window.__origSetItem; }")

    # ---------- 深色模式下主要按鈕的對比度 ----------
    print("\n[dark-contrast] 深色模式下的主要動作按鈕不會變成看不見")
    seed(page)
    page.evaluate("() => { commit(()=>{ state.settings.theme='dark'; }); applyTheme(); }")
    page.click('button:has-text("新增 RUN")')
    page.wait_for_timeout(200)
    contrast = page.evaluate("""() => {
        const btn = document.querySelector('.gbtn.accent');
        const s = getComputedStyle(btn);
        return {bg: s.backgroundColor, color: s.color};
    }""")
    check("深色模式下主要按鈕背景不是淺色的 --ink（不會跟白字疊在一起看不見）",
          contrast["bg"] in ("rgb(238, 240, 244)", "rgb(21, 23, 28)"), False)
    page.evaluate("() => closeSheet()")
    page.wait_for_timeout(150)

    # ---------- 波利人數計量 ----------
    print("\n[poring] 人數格子改為波利圖示 + 跳動動畫")
    seed(page)
    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(150)
    page.evaluate("""() => {
        const r0 = state.roles[0].id;
        for (let i=0;i<6;i++) state.members.push({id:'p'+i,name:'波利員'+i,active:true,defaultRoleId:r0});
        const pt = ptsOf(curDate)[0];
        pt.capacity = 10; pt.slots = [0,1,2].map(i=>({memberId:'p'+i, roleId:r0}));
        persist(); render();
    }""")
    page.wait_for_timeout(200)
    check("波利數量等於人數上限", page.locator(".meter .pip").count(), 10)
    check("已入座的波利數等於實際人數", page.locator(".meter .pip.on").count(), 3)
    check("波利用 SVG symbol 重複引用", page.evaluate("() => !!document.getElementById('ic-poring')"), True)
    check("已入座的波利有跳動動畫",
          page.evaluate("() => getComputedStyle(document.querySelector('.pip.on')).animationName"), "poring-hop")
    check("空位的波利不會跳動",
          page.evaluate("() => getComputedStyle(document.querySelector('.pip:not(.on):not(.full)')).animationName"), "none")
    check("跳動時間有錯開（不會整排同時彈）",
          page.evaluate("""() => {
              const d = [...document.querySelectorAll('.pip.on')].map(e=>getComputedStyle(e).animationDelay);
              return new Set(d).size === d.length;
          }"""), True)
    moved = page.evaluate("""() => new Promise(res => {
        const el = document.querySelector('.pip.on');
        const seen = new Set(); let n = 0;
        const tick = () => {
            seen.add(getComputedStyle(el).transform);
            if (++n > 200) res(seen.size > 1); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    })""")
    check("波利真的會動（跨越一個完整跳躍週期取樣）", moved, True)
    page.evaluate("""() => {
        const pt = ptsOf(curDate)[0];
        pt.slots = Array.from({length:10},(_,i)=>({memberId:'p'+(i%6)}));
        persist(); render();
    }""")
    page.wait_for_timeout(200)
    check("額滿時全部切換成額滿樣式", page.locator(".meter .pip.full").count(), 10)

    # ---------- 複盤錄影 ----------
    print("\n[review] 複盤錄影連結")
    seed(page)

    check("舊的 RUN 會被遷移補上空的 videos 陣列",
          page.evaluate("""() => {
              const old = {schemaVersion:4, members:[], roles:[], sales:[],
                           schedule:{'2026-01-01':[{id:'x',name:'RUN 1',slots:[],drops:[]}]}};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              const pt = m.schedule['2026-01-01'][0];
              return [m.schemaVersion, Array.isArray(pt.videos), pt.videos.length];
          }"""), [page.evaluate("() => SCHEMA_VERSION"), True, 0])
    check("新建的 RUN 自帶 videos 陣列",
          page.evaluate("() => Array.isArray(mkPt('RUN X','20:00',12).videos)"), True)

    # --- 網址解析 ---
    check("標準 watch 網址",
          page.evaluate("() => ytParse('https://www.youtube.com/watch?v=dQw4w9WgXcQ')"),
          {"id": "dQw4w9WgXcQ", "start": 0})
    check("youtu.be 短網址（手機分享最常見）",
          page.evaluate("() => ytParse('https://youtu.be/dQw4w9WgXcQ')"),
          {"id": "dQw4w9WgXcQ", "start": 0})
    check("Shorts 網址",
          page.evaluate("() => ytParse('https://www.youtube.com/shorts/dQw4w9WgXcQ')"),
          {"id": "dQw4w9WgXcQ", "start": 0})
    check("直播網址",
          page.evaluate("() => ytParse('https://www.youtube.com/live/dQw4w9WgXcQ')"),
          {"id": "dQw4w9WgXcQ", "start": 0})
    check("手機版 m.youtube.com",
          page.evaluate("() => ytParse('https://m.youtube.com/watch?v=dQw4w9WgXcQ')"),
          {"id": "dQw4w9WgXcQ", "start": 0})
    check("沒有 https:// 前綴也認得",
          page.evaluate("() => ytParse('youtu.be/dQw4w9WgXcQ')"),
          {"id": "dQw4w9WgXcQ", "start": 0})
    check("時間參數 t=90（純秒數）",
          page.evaluate("() => ytParse('https://youtu.be/dQw4w9WgXcQ?t=90').start"), 90)
    check("時間參數 t=1h2m3s",
          page.evaluate("() => ytParse('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s').start"), 3723)
    check("時間參數 t=45s",
          page.evaluate("() => ytParse('https://youtu.be/dQw4w9WgXcQ?t=45s').start"), 45)
    check("非 YouTube 網址不收",
          page.evaluate("() => ytParse('https://example.com/watch?v=dQw4w9WgXcQ')"), None)
    check("javascript: 網址不收",
          page.evaluate("() => ytParse('javascript:alert(1)')"), None)
    check("影片 id 長度不對就不收",
          page.evaluate("() => ytParse('https://youtu.be/abc')"), None)
    check("空字串不收", page.evaluate("() => ytParse('')"), None)
    check("播放網址一律用解析後的 id 重組，不會沿用貼進來的原始字串",
          page.evaluate("() => ytEmbed('dQw4w9WgXcQ',30).startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')"),
          True)

    # --- 卡片上的入口 ---
    check("每張 RUN 卡片都有複盤按鈕",
          page.locator('.ptcard [data-act="review"]').count(),
          page.evaluate("() => ptsOf(curDate).length"))
    check("沒有錄影時按鈕不標色",
          page.locator('.ptcard [data-act="review"].hasvid').count(), 0)

    # --- 加入連結 ---
    page.locator('.ptcard [data-act="review"]').first.click()
    page.wait_for_timeout(200)
    check("沒有錄影時面板顯示空狀態", page.locator(".sheet .emptystate").count(), 1)
    check("面板列出當時的陣容",
          page.locator(".sheet .rv-row").count(),
          page.evaluate("() => ptsOf(curDate)[0].slots.length"))

    page.fill('.sheet [name="url"]', "https://youtu.be/dQw4w9WgXcQ?t=90")
    page.fill('.sheet [name="label"]', "阿明視角")
    page.click('.sheet [data-s="add"]')
    page.wait_for_timeout(250)
    check("連結存進該場 RUN",
          page.evaluate("() => { const v=ptsOf(curDate)[0].videos; return [v.length, v[0].vid, v[0].start, v[0].label]; }"),
          [1, "dQw4w9WgXcQ", 90, "阿明視角"])
    check("加入後面板換成縮圖", page.locator(".sheet .ytbox .yt-thumb").count(), 1)
    check("縮圖指向該支影片",
          page.evaluate("() => document.querySelector('.sheet .yt-thumb').getAttribute('src')"),
          "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")
    check("有時間點時面板標示起始時間",
          page.locator(".sheet .yt-at").inner_text(), "從 1:30 開始")
    check("在 YouTube 開啟的連結帶著時間點",
          page.locator('.sheet a[target="_blank"]').get_attribute("href"),
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90")

    check("同一支影片不會重複加入",
          page.evaluate("""() => {
              const s = document.querySelector('.sheet');
              s.querySelector('[name="url"]').value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
              s.querySelector('[data-s="add"]').click();
              return ptsOf(curDate)[0].videos.length;
          }"""), 1)
    check("看不懂的網址不會被存進去",
          page.evaluate("""() => {
              const s = document.querySelector('.sheet');
              s.querySelector('[name="url"]').value = 'https://example.com/abc';
              s.querySelector('[data-s="add"]').click();
              return ptsOf(curDate)[0].videos.length;
          }"""), 1)

    # --- 點下去才載入播放器 ---
    check("預設不放 iframe（省流量，離線也不會是一塊白）",
          page.locator(".sheet iframe").count(), 0)
    page.click(".sheet .yt-play")
    page.wait_for_timeout(200)
    check("點播放才插入播放器", page.locator(".sheet iframe.yt-frame").count(), 1)
    check("播放器用 nocookie 網域並帶起始秒數",
          page.evaluate("() => { const s=document.querySelector('.sheet iframe').src; "
                        "return [s.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), s.includes('start=90')]; }"),
          [True, True])

    # --- 多個視角 ---
    page.evaluate("() => { closeSheet(); reviewSheet(ptsOf(curDate)[0].id, 0); }")
    page.wait_for_timeout(150)
    page.fill('.sheet [name="url"]', "https://www.youtube.com/watch?v=aaaaaaaaaaa")
    page.click('.sheet [data-s="add"]')
    page.wait_for_timeout(250)
    check("第二個視角也存得進去",
          page.evaluate("() => ptsOf(curDate)[0].videos.length"), 2)
    check("兩個以上才出現切換列", page.locator(".sheet .vidtab").count(), 2)
    check("沒填標籤時自動用序號當名稱",
          page.locator(".sheet .vidtab").nth(1).inner_text(), "錄影 2")
    check("加入後直接切到新加的那一支",
          page.evaluate("() => document.querySelector('.sheet .yt-thumb').src.includes('aaaaaaaaaaa')"), True)
    page.locator(".sheet .vidtab").first.click()
    page.wait_for_timeout(200)
    check("切換視角會換掉縮圖",
          page.evaluate("() => document.querySelector('.sheet .yt-thumb').src.includes('dQw4w9WgXcQ')"), True)

    # --- 刪除 ---
    page.locator('.sheet [data-del="1"]').click()
    page.wait_for_timeout(250)
    check("刪除後只剩一支",
          page.evaluate("() => { const v=ptsOf(curDate)[0].videos; return [v.length, v[0].vid]; }"),
          [1, "dQw4w9WgXcQ"])
    page.evaluate("() => closeSheet()")
    page.wait_for_timeout(150)
    check("有錄影的 RUN 按鈕會標色並顯示數量",
          page.locator('.ptcard [data-act="review"].hasvid').first.inner_text(), "複盤1")

    # --- 不該被帶走的地方 ---
    check("複製 RUN 不會把錄影連結一起複製",
          page.evaluate("""() => {
              const before = ptsOf(curDate).length;
              document.querySelector('.ptcard [data-act="dupPt"]').click();
              const copy = ptsOf(curDate)[ptsOf(curDate).length-1];
              return [ptsOf(curDate).length - before, copy.videos.length, copy.slots.length > 0];
          }"""), [1, 0, True])
    check("錄影連結會一起匯出備份",
          page.evaluate("""() => {
              const dump = JSON.parse(JSON.stringify(state));
              return dump.schedule[curDate][0].videos[0].vid;
          }"""), "dQw4w9WgXcQ")

    # --- 刪除前的警告要把錄影算進去 ---
    check("刪除單場 RUN 會列出裡面有什麼會一起消失",
          page.evaluate("""() => {
              // 這場原本沒有掉落紀錄，先補一筆，才驗得到三種內容都列出來
              ptsOf(curDate)[0].drops = [{id:'dz', name:'威力隕石碎片', qty:2}];
              render();
              document.querySelector('.ptcard [data-act="delPt"]').click();
              const t = document.querySelector('.sheet p').textContent;
              closeSheet();
              return [t.includes('錄影連結'), t.includes('掉落紀錄'), t.includes('排班位子')];
          }"""), [True, True, True])
    check("刪除整天的確認訊息也會算進錄影連結",
          page.evaluate("""() => {
              document.getElementById('btnDelDate').click();
              const t = document.querySelector('.sheet p').textContent;
              closeSheet();
              return t.includes('個錄影連結');
          }"""), True)
    check("沒有錄影的 RUN 不會硬寫「0 個錄影連結」",
          page.evaluate("""() => {
              const p = ptsOf(curDate).find(x => !(x.videos||[]).length);
              document.querySelector('.ptcard[data-pt="'+p.id+'"] [data-act="delPt"]').click();
              const t = document.querySelector('.sheet p').textContent;
              closeSheet();
              return t.includes('錄影');
          }"""), False)

    # ---------- 材料頁改版 ----------
    print("\n[matui] 材料頁：主結果卡、瓶頸、收合明細")
    seed(page)
    page.evaluate("""() => {
        const MATS=['威力隕石浮塵','耐力隕石浮塵','專注隕石浮塵','創造隕石浮塵','咒數隕石浮塵','智慧隕石浮塵',
                    '威力隕石碎片','耐力隕石碎片','專注隕石碎片','創造隕石碎片','咒數隕石碎片','智慧隕石碎片'];
        state.schedule = {};
        ['2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05'].forEach((k,di) => {
            state.schedule[k] = [{id:'p'+di, name:'RUN 1', time:'20:00', capacity:12,
                slots:[{memberId:'m1'}],
                // 咒數隕石浮塵刻意給少，做成唯一瓶頸
                drops: MATS.map((n,i) => ({id:'d'+di+i, name:n, qty: n==='咒數隕石浮塵' ? 2 : 6})),
                videos:[]}];
        });
        curDate='2026-08-05'; matFrom=''; matTo=''; matRunName=''; matPerSet=5; matOpenDays=null;
        persist(); render();
    }""")
    page.click('.tab[data-view="stats"]')
    page.wait_for_timeout(400)

    check("主結果卡顯示可組成組數",
          page.locator("#matCards .mres-v").inner_text().replace("組", ""), "2")
    check("主結果卡點出瓶頸材料",
          page.locator("#matCards .mres-nn").inner_text(), "咒數隕石浮塵")
    check("瓶頸列標出還差多少進下一組",
          "再 5 個進下一組" in page.locator("#matCards .mres-nv").inner_text(), True)
    check("主結果卡有每場平均（總量會隨天數長，平均才有比較基準）",
          "每場平均 68.0 個" in page.locator("#matCards .mres-meta").inner_text(), True)
    check("舊的四張統計卡已移除",
          page.locator("#matCards .stat").count(), 0)
    check("組數試算頁不再重複顯示組數卡",
          page.evaluate("() => !!document.getElementById('setCards')"), False)
    check("兩天以上才畫每日走勢", page.locator("#matCards .spark").count(), 1)

    check("只有瓶頸材料標成琥珀色",
          page.locator("#matBars .bar-row.short").count(), 1)
    check("標到的就是瓶頸那一種",
          page.locator("#matBars .bar-row.short .bar-l").inner_text(), "咒數隕石浮塵")

    # --- 篩選狀態看得出來 ---
    check("沒篩選時不標色，清除鈕收著",
          [page.locator("#matFiltBtn").get_attribute("class").find("on") >= 0,
           page.locator("#matFiltClear").is_visible()], [False, False])
    page.evaluate("() => { matRunName='RUN 1'; renderMaterials(); }")
    page.wait_for_timeout(200)
    check("篩選生效時標色且出現清除鈕",
          ["on" in page.locator("#matFiltBtn").get_attribute("class"),
           page.locator("#matFiltClear").is_visible()], [True, True])
    page.click("#matFiltClear")
    page.wait_for_timeout(300)
    check("清除鈕一次清掉日期與場次",
          page.evaluate("() => [matFrom, matTo, matRunName]"), ["", "", ""])

    # --- 場次明細收合 ---
    page.click('#matSeg button[data-sub="detail"]')
    page.wait_for_timeout(400)
    check("明細按日期分組", page.locator("#matDetail .mday").count(), 5)
    check("預設只展開最近 3 天", page.locator("#matDetail .mday.open").count(), 3)
    check("收合的日期不渲染場次卡",
          page.locator("#matDetail .mday:not(.open) .mrun").count(), 0)
    page.locator("#matDetail .mday:not(.open) .mday-h").first.click()
    page.wait_for_timeout(300)
    check("點日期可以展開", page.locator("#matDetail .mday.open").count(), 4)
    page.locator("#matDetail .mday.open .mday-h").first.click()
    page.wait_for_timeout(300)
    check("再點一次收回去", page.locator("#matDetail .mday.open").count(), 3)

    # --- 一鍵全部展開／收合 ---
    check("工具列顯示天數與場數摘要",
          page.locator("#matDetail .mday-bar-t").inner_text(), "5 天 · 5 場")
    check("沒有全開時按鈕是「全部展開」",
          page.locator("#matDetail [data-act='matDayAll']").inner_text().strip(), "全部展開")
    page.click("#matDetail [data-act='matDayAll']")
    page.wait_for_timeout(400)
    check("按一下全部展開", page.locator("#matDetail .mday.open").count(), 5)
    check("全開後按鈕換成「全部收合」",
          page.locator("#matDetail [data-act='matDayAll']").inner_text().strip(), "全部收合")
    page.click("#matDetail [data-act='matDayAll']")
    page.wait_for_timeout(400)
    check("再按一下全部收合", page.locator("#matDetail .mday.open").count(), 0)
    check("全收合時不渲染任何場次卡", page.locator("#matDetail .mrun").count(), 0)
    check("按鈕字樣換回「全部展開」",
          page.locator("#matDetail [data-act='matDayAll']").inner_text().strip(), "全部展開")
    # 全開後縮小篩選範圍，按鈕要照「目前範圍」判斷，不能被範圍外的日期影響
    page.click("#matDetail [data-act='matDayAll']")
    page.wait_for_timeout(300)
    page.evaluate("() => { matFrom='2026-08-01'; matTo='2026-08-03'; renderMaterials(); }")
    page.wait_for_timeout(300)
    check("縮小篩選後仍正確判斷為全開",
          [page.locator("#matDetail .mday").count(),
           page.locator("#matDetail [data-act='matDayAll']").inner_text().strip()], [3, "全部收合"])
    page.evaluate("() => { matFrom=''; matTo=''; renderMaterials(); }")
    page.wait_for_timeout(300)

    # --- 從明細直接編輯其他天的掉落 ---
    check("明細不再借用匯出圖片的樣式",
          page.locator("#matDetail .ex-pt").count(), 0)
    other = page.evaluate("""() => {
        const h = [...document.querySelectorAll('.mrun-h')].find(x => x.dataset.day !== curDate);
        return h ? h.dataset.day : null;
    }""")
    check("明細裡找得到非今天的場次", other is not None and other != "2026-08-05", True)
    page.evaluate("""() => {
        const h = [...document.querySelectorAll('.mrun-h')].find(x => x.dataset.day !== curDate);
        h.click();
    }""")
    page.wait_for_timeout(300)
    check("跨日期編輯時面板標題會標出是哪一天",
          page.locator(".sheet-t").inner_text().startswith(page.evaluate(f"() => fmtDate('{other}')")), True)
    page.evaluate("""() => {
        const s = document.querySelector('.sheet'), row = s.querySelector('.droprow');
        const q = row.querySelector('[data-qty]');
        q.value = '77'; q.dispatchEvent(new Event('input', {bubbles:true}));
        s.querySelector('[data-s="save"]').click();
    }""")
    page.wait_for_timeout(300)
    check("存檔改到的是目標那天",
          page.evaluate(f"() => ptsOf('{other}').some(p => p.drops.some(d => d.qty === 77))"), True)
    check("目前這天沒被誤改",
          page.evaluate("() => !ptsOf(curDate).some(p => p.drops.some(d => d.qty === 77))"), True)
    check("編輯其他天不會把畫面切走",
          page.evaluate("() => curDate"), "2026-08-05")

    # --- 系列配色 ---
    check("材料分成四類各自給色，另有「其餘」接住自訂材料",
          page.evaluate("() => MAT_SERIES.map(s => [s.key, s.label])"),
          [["shard", "碎片"], ["dust", "浮塵"], ["unknown", "未知"],
           ["rune", "稀微"], ["other", "其餘"]])
    check("四種材料各自落到正確系列",
          page.evaluate("""() => ['威力隕石碎片','威力隕石浮塵','未知的隕石碎片','稀微魔力符文石','自訂材料']
              .map(n => matSeries(n).key)"""),
          ["shard", "dust", "unknown", "rune", "other"])
    check("未知與稀微不再被歸進同一堆灰色",
          page.evaluate("() => matSeries('未知的隕石碎片').key !== matSeries('稀微魔力符文石').key"), True)
    check("四類的顏色互不相同",
          page.evaluate("""() => {
              const c = ['shard','dust','unknown','rune'].map(k =>
                  getComputedStyle(document.documentElement).getPropertyValue('--ms-'+k).trim());
              return new Set(c).size;
          }"""), 4)
    # 「顏色不一樣」不等於「分得出來」——藍與青只差 30 度，在細長條上是同一個顏色。
    # 守住色相距離才擋得住日後又改回相近的配色。
    check("任兩類的色相至少差 55 度（淺色與深色模式都要成立）",
          page.evaluate("""() => {
              const hue = hex => {
                  const n = parseInt(hex.slice(1), 16);
                  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
                  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
                  if (!d) return 0;
                  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
                  return (h * 60 + 360) % 360;
              };
              const gap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
              const keys = ['shard','dust','unknown','rune'];
              const worst = [];
              [document.documentElement.dataset.theme, 'dark', ''].slice(1).forEach(t => {
                  const prev = document.documentElement.dataset.theme;
                  document.documentElement.dataset.theme = t;
                  const cs = getComputedStyle(document.documentElement);
                  const hs = keys.map(k => hue(cs.getPropertyValue('--ms-' + k).trim()));
                  for (let i = 0; i < hs.length; i++)
                      for (let j = i + 1; j < hs.length; j++) worst.push(gap(hs[i], hs[j]));
                  document.documentElement.dataset.theme = prev;
              });
              return Math.round(Math.min(...worst)) >= 55;
          }"""), True)
    check("材料色避開刪除紅與瓶頸琥珀（那兩色有固定語意）",
          page.evaluate("""() => {
              const reserved = ['#dc2626', '#b45309'];
              return MAT_SERIES.every(s => !reserved.includes(s.color.toLowerCase()));
          }"""), True)
    check("材料系列色改由 CSS 變數供色（深色模式才調得動）",
          page.evaluate("() => msVars(MAT_SERIES[0]).includes('var(--ms-shard)')"), True)
    check("匯出圖片仍使用寫死的淺色色值（匯出一律白底）",
          page.evaluate("() => /^#[0-9a-f]{6}$/i.test(MAT_SERIES[0].color)"), True)
    check("找不到系列時退回最後一項，不寫死索引",
          page.evaluate("() => matSeries('完全沒見過的東西').key"), "other")
    check("掉落編輯面板也照四類分段",
          page.evaluate("""() => {
              dropsSheet(ptsOf(curDate)[0].id);
              const g = [...document.querySelectorAll('.dropgrp')].map(e => e.textContent);
              closeSheet();
              return g;
          }"""), ["碎片", "浮塵", "未知", "稀微"])

    # --- 組數預設 ---
    # matPerSet 是工作階段變數，前面的測試改過它，直接讀當下的值驗不到「預設」。
    # 重新載入頁面才是使用者第一次開啟時看到的狀態。
    page.reload()
    page.wait_for_load_state("networkidle")
    check("組數預設為 1 個 = 1 組（重新載入後）",
          page.evaluate("""() => [document.getElementById('matPerSet').value, matPerSet]"""),
          ["1", 1])

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

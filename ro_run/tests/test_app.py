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
        // 時間屬於整天（schemaVersion 6 起），不再掛在單場 RUN 上
        state.dayTimes = {'2026-08-01':'19:00', '2026-08-05':'21:00'};
        state.schedule['2026-08-01'] = [
            {id:'ptA', name:'RUN A1', capacity:5,
             slots:[{memberId:'m1'}], drops:[{id:'d1',name:'威力隕石碎片',qty:3}]}
        ];
        state.schedule['2026-08-05'] = [
            {id:'ptB', name:'RUN B1', capacity:10,
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
                      m.sales[0].sets, m.sales[0].price, m.sales[0].cur,
                      m.sales[0].twd === undefined, m.sales[0].rate === undefined];
          }"""), ["set", True, 0, 3, 100, "TWD", True, True])
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
              saleDraftItems[0] = {name:'威力隕石碎片', qty:4, price:25};
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
        saleDraftItems = [{name:'', qty:'', price:''}];   // 還原草稿，不要污染後面的拍賣測試
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
    page.fill("#salePrice", "100")
    page.click("#saleAdd")
    page.wait_for_timeout(200)
    check("新增交易", page.evaluate("() => state.sales.length"), 1)

    page.click(".salerow-edit")
    page.wait_for_timeout(200)
    page.fill('input[name="sets"]', "9")
    page.fill('input[name="price"]', "150")
    page.click('[data-s="save"]')
    page.wait_for_timeout(200)
    check("編輯交易",
          page.evaluate("() => [state.sales[0].sets, state.sales[0].price]"), [9, 150])

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

    load_sales([{"id": "a1", "date": "2026-08-05", "cur": "TWD", "sets": 10, "price": 100}])
    check("只有一筆時不畫走勢圖",
          page.evaluate("() => document.querySelectorAll('#saleTrend .spark').length"), 0)
    check("只有一筆時仍列出該筆成交",
          page.evaluate("() => document.querySelectorAll('#saleList .auccard').length"), 1)

    six = [
        {"id": "b1", "date": "2026-05-12", "cur": "TWD", "sets": 6, "price": 110},
        {"id": "b2", "date": "2026-06-03", "cur": "TWD", "sets": 10, "price": 98},
        {"id": "b3", "date": "2026-06-21", "cur": "TWD", "sets": 8, "price": 125},
        {"id": "b4", "date": "2026-07-09", "cur": "TWD", "sets": 12, "price": 140},
        {"id": "b5", "date": "2026-07-28", "cur": "TWD", "sets": 5, "price": 132},
        {"id": "b6", "date": "2026-08-05", "cur": "TWD", "sets": 14, "price": 155},
    ]
    load_sales(six)
    # 成交紀錄預設只畫最近三個月，其餘用按鈕往前補（帳只會愈來愈長，全部重建太貴）
    check("成交紀錄預設只顯示最近三個月",
          page.evaluate("() => document.querySelectorAll('#saleList .aucmon').length"), 3)
    check("按鈕明講還藏著幾個月幾筆，不讓人懷疑自己看到的是不是全部",
          page.evaluate("""() => {
              const b = document.querySelector('[data-act="ledgerMore"]');
              return b ? b.textContent.replace(/\s+/g, ' ').trim() : null;
          }"""),
          "顯示更早的紀錄（還有 1 個月 · 1 筆）")
    check("被藏起來的是最舊的那個月，不是最新的",
          page.evaluate("""() => [...document.querySelectorAll('.aucmon-t')].map(e=>e.textContent)"""),
          ["2026 年 8 月", "2026 年 7 月", "2026 年 6 月"])

    # 展開之後行為與原本完全一致，以下沿用原有的斷言
    page.evaluate("""() => document.querySelector('[data-act="ledgerMore"]').click()""")
    page.wait_for_timeout(120)
    check("按下之後全部月份都出來，按鈕跟著消失",
          page.evaluate("""() => [document.querySelectorAll('#saleList .aucmon').length,
                                  !!document.querySelector('[data-act="ledgerMore"]')]"""),
          [4, False])
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
    check("成交卡片顯示組數與每組價（換算率已隨幣別拆分移除）",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .auccard')[0]
              .querySelectorAll('.auc-chip')].map(e=>e.textContent)"""),
          ["14 組", "每組 155"])

    check("平均每組價用加權算（總額 ÷ 總組數）",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '平均每組')
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
    many = [{"id": f"c{i}", "date": f"2026-{m:02d}-10", "cur": "TWD", "sets": 5, "price": 100 + i}
            for i, m in enumerate(range(1, 9))]
    load_sales(many)
    check("月度長條最多只顯示近六個月",
          page.evaluate("() => document.querySelectorAll('.mbars .mbar').length"), 6)
    check("留下的是最新的六個月",
          page.evaluate("() => [...document.querySelectorAll('.mbar-l')].map(e=>e.textContent)"),
          ["3 月", "4 月", "5 月", "6 月", "7 月", "8 月"])

    # 編輯過日期的紀錄要照日期排，但品項編號沿用當初記錄的先後
    load_sales([
        {"id": "d1", "date": "2026-08-20", "cur": "TWD", "sets": 5, "price": 100},
        {"id": "d2", "date": "2026-08-02", "cur": "TWD", "sets": 5, "price": 100},
    ])
    check("日期被改過也照日期排序，編號不跟著跳動",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .auccard')].map(c => [
              c.querySelector('.auc-lot').textContent,
              c.querySelector('.auc-date').textContent.trim().split(' ')[0]
          ])"""), [["#1", "08/20"], ["#2", "08/02"]])

    # ---------- 拍賣：單品出售 ----------
    print("\n[auction] 單品出售與單品行情")
    mixed = [
        {"id": "m1", "date": "2026-06-03", "mode": "set", "cur": "TWD", "sets": 10, "price": 100,
         "items": []},
        {"id": "m2", "date": "2026-07-09", "mode": "item", "cur": "TWD", "sets": 0, "price": 0,
         "items": [{"name": "威力隕石碎片", "qty": 20, "price": 10},
                   {"name": "耐力隕石浮塵", "qty": 10, "price": 8}]},
        {"id": "m3", "date": "2026-08-05", "mode": "item", "cur": "TWD", "sets": 0, "price": 0,
         "items": [{"name": "威力隕石碎片", "qty": 30, "price": 20}]},
    ]
    load_sales(mixed)
    check("單品交易的總額為各列數量 × 單價相加",
          page.evaluate("() => [saleAmounts(state.sales[1]).amt, saleAmounts(state.sales[2]).amt]"),
          [280, 600])
    check("累計售出組數只算整組交易",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '累計售出組數')
              .querySelector('.stat-v').textContent"""), "10")
    check("累計售出單品只算單品交易",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '累計售出單品')
              .querySelector('.stat-v').textContent"""), "60")
    check("平均每組價不被單品交易稀釋",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .find(c => c.querySelector('.stat-k').textContent === '平均每組')
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
          ["威力隕石碎片 ×20 @10", "耐力隕石浮塵 ×10 @8"])

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
    page.fill('#saleItemRows [data-f="price"]', "25")
    page.wait_for_timeout(150)
    check("明細列即時算出小計",
          page.evaluate("() => document.querySelector('.itemrow-s').textContent"), "150")
    page.click("#saleAdd")
    page.wait_for_timeout(300)
    check("記錄單品交易會存成 mode='item'",
          page.evaluate("""() => {
              const s = state.sales[state.sales.length-1];
              return [s.mode, s.items.length, s.items[0].name, s.items[0].qty, s.items[0].price];
          }"""), ["item", 1, "智慧隕石浮塵", 6, 25])
    check("記錄後明細列清空成一列空白",
          page.evaluate("""() => document.querySelectorAll('#saleItemRows .itemrow').length"""), 1)

    page.click('#saleModeSeg [data-mode="set"]')
    page.wait_for_timeout(200)
    # 記錄完就清空：留著上一筆的組數與歸屬場次最危險，
    # 下一筆很容易在沒注意的情況下沿用舊的歸屬，而那直接決定錢分給誰。
    check("記錄完一筆之後，組數、價格、歸屬場次都清乾淨",
          page.evaluate("""() => [document.getElementById('salePrice').value,
              saleRunIds.length,
              document.querySelector('#saleRunPick [data-rp="btn"]').textContent.trim(),
              document.querySelector('#saleRunPick [data-rp="body"]').hidden]"""),
          ["", 0, "未指定（當天平均分攤）", True])

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
              .find(c => c.querySelector('.stat-k').textContent === '累計總額')
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
    check("成員頁有三個子分頁，成員列表在前",
          page.evaluate("""() => [...document.querySelectorAll('#memberSeg [data-sub]')]
              .map(b => [b.dataset.sub, b.textContent])"""),
          [["mlist", "成員列表"], ["mroles", "職業設定"], ["mattend", "出場統計"]])
    check("進入成員頁預設顯示成員列表",
          page.evaluate("""() => [document.getElementById('sub-mlist').classList.contains('active'),
                                  document.getElementById('sub-mroles').classList.contains('active'),
                                  document.getElementById('sub-mattend').classList.contains('active')]"""),
          [True, False, False])
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
          page.evaluate("""() => ['saleSets','salePrice','saleAdd','saleList']
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
    check("主程式依固定順序載入 11 個檔案",
          page.evaluate("""() => [...document.querySelectorAll('script[src^="./js/"]')]
              .map(s => s.getAttribute('src').replace('./js/','').replace('.js',''))"""),
          ["data", "render", "materials", "auction", "attend", "assign",
           "sheets", "export", "events", "calc", "main"])
    check("拆檔後仍共用同一個全域範圍",
          page.evaluate("""() => {
              // 這幾個分別定義在不同檔案裡，彼此看得到才代表拆檔沒有切斷相依
              return [typeof state, typeof commit, typeof renderBoard,
                      typeof renderMaterials, typeof saleAmounts, typeof assign,
                      typeof sheet, typeof exportJson, typeof renderCalc,
                      typeof attendanceStats];
          }"""), ["object"] + ["function"] * 9)
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
              return ['data','render','materials','auction','attend','assign',
                      'sheets','export','events','calc','main']
                  .every(n => src.includes(`./js/${n}.js`));
          }"""), True)

    # ---------- 切分頁的捲動位置與雙擊縮放 ----------
    print("\n[ux] 切分頁捲動位置與雙擊縮放")
    seed(page)
    # 塞夠多資料讓陣容頁可以往下捲
    page.evaluate("""() => {
        for (let i = 0; i < 12; i++)
            state.schedule['2026-08-05'].push({id:'sp'+i, name:'RUN '+i,
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
    check("新增 RUN 表單不再有時間欄位（時間屬於整天）",
          page.locator('.sheet input[name="time"]').count(), 0)
    check("新增 RUN 表單會說明時間在哪裡改",
          "日期列" in page.locator(".sheet .fieldnote").inner_text(), True)
    check("新增 RUN 表單帶入新的預設人數上限",
          page.eval_on_selector('input[name="cap"]', "el => el.value"), "6")
    page.evaluate("() => closeSheet()")
    page.wait_for_timeout(150)
    check("預設時間改為套用在新建立的日期上",
          page.evaluate("() => { delete state.schedule['2026-12-25']; if (state.dayTimes) delete state.dayTimes['2026-12-25']; ensureDate('2026-12-25'); return dayTime('2026-12-25'); }"), "21:30")
    page.click('button:has-text("新增 RUN")')
    page.wait_for_timeout(200)
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
    # .gbtn 是 inline-flex，inner_text 會在標籤與數量之間插入換行，視覺上仍是並排
    check("有錄影的 RUN 按鈕會標色並顯示數量",
          page.locator('.ptcard [data-act="review"].hasvid').first.inner_text().replace("\n", ""), "複盤1")

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
            state.schedule[k] = [{id:'p'+di, name:'RUN 1', capacity:12,
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

    # ---------- PWA 強化 ----------
    print("\n[pwa] 儲存保護、分享目標、復原、離線、觸控")
    seed(page)

    # --- 儲存持久化 ---
    check("啟動時會向瀏覽器要求持久化儲存",
          page.evaluate("() => typeof ensurePersistentStorage === 'function'"), True)
    check("持久化狀態有記錄下來（true / false / null）",
          page.evaluate("() => [true, false, null].includes(storagePersisted)"), True)
    check("設定頁會顯示儲存保護狀態",
          page.evaluate("""() => {
              moreSheet();
              const row = document.getElementById('rowPersist');
              const txt = row ? row.textContent : '';
              closeSheet();
              return [!!row, txt.includes('儲存保護')];
          }"""), [True, True])
    check("沒取得保護時會告訴使用者怎麼辦，而不是只說失敗",
          page.evaluate("""() => {
              const saved = storagePersisted;
              storagePersisted = false;
              const t = persistStatusText();
              storagePersisted = saved;
              return t.includes('主畫面') || t.includes('匯出');
          }"""), True)

    # --- 單步復原 ---
    check("刪除 RUN 後可以復原",
          page.evaluate("""() => {
              const before = ptsOf(curDate).length;
              const name = ptsOf(curDate)[0].name;
              commitUndoable('測試', () => { state.schedule[curDate] = ptsOf(curDate).slice(1); });
              const afterDel = ptsOf(curDate).length;
              document.querySelector('.toast-btn').click();
              return [afterDel === before - 1,
                      ptsOf(curDate).length === before,
                      ptsOf(curDate)[0].name === name];
          }"""), [True, True, True])
    check("復原按鈕上的文字說明刪掉的是什麼",
          page.evaluate("""() => {
              commitUndoable('「RUN 9」', () => {});
              const t = document.querySelector('.toast').textContent;
              document.querySelector('.toast-btn').click();
              return t.includes('已刪除「RUN 9」') && t.includes('復原');
          }"""), True)
    check("復原也會把資料寫回 localStorage，不只改記憶體",
          page.evaluate("""() => {
              const before = ptsOf(curDate).length;
              commitUndoable('測試', () => { state.schedule[curDate] = []; });
              document.querySelector('.toast-btn').click();
              flushPersist();
              return JSON.parse(localStorage.getItem(KEY)).schedule[curDate].length === before;
          }"""), True)
    check("復原只保留最後一次，不累積堆疊（v33 移除 undo 堆疊的原因）",
          page.evaluate("() => typeof commitUndoable === 'function' && typeof window.undoStack === 'undefined'"), True)

    # --- 分享目標 ---
    check("能從分享過來的純文字裡撈出 YouTube 網址",
          page.evaluate("""() => {
              const raw = '快來看 https://youtu.be/dQw4w9WgXcQ?t=90 這段';
              let parsed = null;
              for (const u of (raw.match(/https?:\\/\\/\\S+/g) || [])) { parsed = ytParse(u); if (parsed) break; }
              return parsed;
          }"""), {"id": "dQw4w9WgXcQ", "start": 90})
    check("分享面板列出當天每一場 RUN 讓人挑",
          page.evaluate("""() => {
              shareVideoSheet({id: 'dQw4w9WgXcQ', start: 90}, curDate);
              const n = document.querySelectorAll('.sv-row').length;
              const title = document.querySelector('.sheet-t').textContent;
              closeSheet();
              return [n === ptsOf(curDate).length, n > 0, title];
          }"""), [True, True, "加入錄影連結"])
    check("已經有同一支影片的場次不能重複掛",
          page.evaluate("""() => {
              const p = ptsOf(curDate)[0];
              p.videos = [{id: 'v1', vid: 'dQw4w9WgXcQ', start: 0, label: ''}];
              shareVideoSheet({id: 'dQw4w9WgXcQ', start: 90}, curDate);
              const first = document.querySelector('.sv-row');
              const r = [first.disabled, first.textContent.includes('已經有這支影片')];
              closeSheet();
              p.videos = [];
              return r;
          }"""), [True, True])

    # --- 離線狀態 ---
    check("有離線狀態列，且平常收著",
          page.evaluate("""() => {
              const el = document.getElementById('offlinebar');
              return [!!el, el.classList.contains('in')];
          }"""), [True, False])
    check("離線列走文件流，不會蓋住標題列",
          page.evaluate("""() => {
              const el = document.getElementById('offlinebar');
              return getComputedStyle(el).position !== 'fixed';
          }"""), True)

    # --- manifest ---
    check("manifest 註冊了分享目標與捷徑",
          page.evaluate("""async () => {
              const m = await (await fetch('./manifest.webmanifest')).json();
              return [!!m.share_target, (m.shortcuts || []).length, (m.screenshots || []).length];
          }"""), [True, 3, 2])
    check("捷徑帶的分頁參數都對得到實際分頁",
          page.evaluate("""async () => {
              const m = await (await fetch('./manifest.webmanifest')).json();
              return m.shortcuts.every(s => {
                  const tab = new URL(s.url, location.href).searchParams.get('tab');
                  return !!document.querySelector('.tab[data-view="' + tab + '"]');
              });
          }"""), True)

    # --- 觸控目標 ---
    # 用 offsetHeight 而不是 getBoundingClientRect：RUN 卡片有進場動畫（含 scale），
    # 動畫途中量 rect 會拿到被縮放過的高度，測試就會時好時壞。offsetHeight 是版面高度，不受 transform 影響。
    page.wait_for_timeout(600)
    check("沒有實際可點高度低於 44px 的控制項",
          page.evaluate("""() => {
              const tooSmall = [];
              document.querySelectorAll('button, .tab, input, select, .chip').forEach(el => {
                  if (!el.offsetWidth || !el.offsetHeight) return;
                  const after = parseFloat(getComputedStyle(el, '::after').height) || 0;
                  if (Math.max(el.offsetHeight, after) < 44) tooSmall.push(el.className.split(' ')[0] || el.tagName);
              });
              return [...new Set(tooSmall)];
          }"""), [])
    check("刪除鍵的可點範圍沒有蓋到旁邊的職業標籤",
          page.evaluate("""() => {
              const s = document.querySelector('.slot');
              if (!s) return true;
              const rp = s.querySelector('.rolepill').getBoundingClientRect();
              const x = s.querySelector('.slot-x').getBoundingClientRect();
              return rp.right <= x.left;
          }"""), True)

    # --- 可存取性 ---
    check("所有輸入欄都有可讀名稱",
          page.evaluate("""() => [...document.querySelectorAll('input, select')]
              .filter(i => !i.labels?.length && !i.getAttribute('aria-label')).length"""), 0)

    # ---------- 時間一天一個 ----------
    print("\n[daytime] 集合時間統一與圖片分享")
    seed(page)

    check("時間存在 dayTimes，RUN 上不留第二份",
          page.evaluate("""() => [!!state.dayTimes, ptsOf(curDate).some(p => 'time' in p)]"""),
          [True, False])
    check("新建的 RUN 不帶時間欄位",
          page.evaluate("() => 'time' in mkPt('RUN X', 12)"), False)
    check("舊資料遷移時取該天第一個有填時間的 RUN",
          page.evaluate("""() => {
              const old = {schemaVersion: 5, members: [], roles: [], sales: [],
                  schedule: {'2026-01-01': [
                      {id:'a', name:'RUN 1', time:'',      slots:[], drops:[], videos:[]},
                      {id:'b', name:'RUN 2', time:'22:00', slots:[], drops:[], videos:[]},
                      {id:'c', name:'RUN 3', time:'23:00', slots:[], drops:[], videos:[]}]}};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [m.dayTimes['2026-01-01'],
                      m.schedule['2026-01-01'].every(p => !('time' in p))];
          }"""), ["22:00", True])
    check("整天都沒填時間時遷移成空字串，不會變 undefined",
          page.evaluate("""() => {
              const old = {schemaVersion: 5, members: [], roles: [], sales: [],
                  schedule: {'2026-02-02': [{id:'a', name:'RUN 1', slots:[], drops:[], videos:[]}]}};
              return migrate(old).dayTimes['2026-02-02'];
          }"""), "")

    page.evaluate("() => { setDayTime(curDate, '20:30'); render(); }")
    page.wait_for_timeout(200)
    check("時間顯示在日期列上", page.locator("#btnDayTime").inner_text(), "20:30")
    check("RUN 卡片不再各印一次時間",
          page.evaluate("() => !!document.querySelector('.ptcard .pt-time')"), False)
    page.evaluate("() => { setDayTime(curDate, ''); render(); }")
    page.wait_for_timeout(200)
    check("沒設定時間時按鈕會提示去設定",
          [page.locator("#btnDayTime").inner_text(),
           "unset" in page.locator("#btnDayTime").get_attribute("class")], ["設定時間", True])

    check("改一次時間，當天所有 RUN 一起生效",
          page.evaluate("""() => {
              setDayTime(curDate, '21:00');
              // 同一天的每一場都讀到同一個時間
              return ptsOf(curDate).every(() => dayTime(curDate) === '21:00');
          }"""), True)
    check("不同日期的時間互不影響",
          page.evaluate("""() => {
              setDayTime('2026-08-01', '19:00');
              setDayTime('2026-08-05', '23:00');
              return [dayTime('2026-08-01'), dayTime('2026-08-05')];
          }"""), ["19:00", "23:00"])
    check("時間會跟著備份一起走",
          page.evaluate("""() => {
              flushPersist();
              return JSON.parse(localStorage.getItem(KEY)).dayTimes['2026-08-01'];
          }"""), "19:00")

    # --- 匯出圖片 ---
    page.evaluate("() => { curDate = '2026-08-01'; setDayTime(curDate, '19:00'); render(); }")
    page.wait_for_timeout(200)
    check("匯出圖片的標題帶當天時間",
          page.evaluate("""() => {
              buildExportNode([curDate]);
              const h = document.querySelector('#exportWrap .ex-h').textContent;
              document.getElementById('exportHost').innerHTML = '';
              return h.includes('19:00');
          }"""), True)
    check("匯出圖片的 RUN 卡片不再重複印時間",
          page.evaluate("""() => {
              buildExportNode([curDate]);
              const n = document.querySelectorAll('#exportWrap .ex-pt-t').length;
              document.getElementById('exportHost').innerHTML = '';
              return n;
          }"""), 0)
    check("CSV 的時間欄改讀當天時間",
          page.evaluate("""() => {
              let captured = null;
              const orig = window.download;
              window.download = blob => { captured = blob; };
              exportCsv(['2026-08-01']);
              window.download = orig;
              return captured ? captured.text() : null;
          }""").__contains__("19:00"), True)

    # --- 分享只帶圖片 ---
    check("分享時只帶檔案，不附文字訊息",
          page.evaluate("""async () => {
              let keys = null;
              const oc = navigator.canShare, os = navigator.share;
              navigator.canShare = () => true;
              navigator.share = async d => { keys = Object.keys(d).sort(); };
              await exportImage([curDate]);
              navigator.canShare = oc; navigator.share = os;
              return keys;
          }"""), ["files"])

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

    # ---------- 翻車標記 ----------
    print("\n[wipe] 翻車標記")
    # seed() 每天只有一場，隔離性測不出來；這裡在同一天補第二場，
    # 而且讓它有掉落物，後面的場次明細才會列到它（明細只列有掉落的場次）。
    def seed_two_runs():
        seed(page)
        page.evaluate("""() => {
            state.schedule[curDate].push({
                id:'ptC', name:'RUN B2', capacity:8, wipe:false, videos:[],
                slots:[{memberId:'m2'}],
                drops:[{id:'d9', name:'威力隕石碎片', qty:2}]});
            persist(); render();
        }""")
        page.wait_for_timeout(150)

    seed_two_runs()

    check("6→7 遷移會替舊場次補上 wipe=false",
          page.evaluate("""() => {
              const old = {schemaVersion:6, members:[], roles:[], sales:[], dayTimes:{},
                  schedule:{'2026-01-01':[{id:'a',name:'RUN 1',capacity:12,slots:[],drops:[],videos:[]}]}};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              const pt = m.schedule['2026-01-01'][0];
              return [typeof pt.wipe, pt.wipe, m.schemaVersion === SCHEMA_VERSION];
          }"""), ["boolean", False, True])

    check("已標記翻車的資料再跑一次遷移不會被覆蓋回去",
          page.evaluate("""() => {
              const old = {schemaVersion:6, members:[], roles:[], sales:[], dayTimes:{},
                  schedule:{'2026-01-01':[{id:'a',name:'RUN 1',capacity:12,wipe:true,slots:[],drops:[],videos:[]}]}};
              return migrate(JSON.parse(JSON.stringify(old))).schedule['2026-01-01'][0].wipe;
          }"""), True)

    check("新建的 RUN 預設是通關",
          page.evaluate("() => mkPt('RUN X', 12).wipe"), False)

    check("isWipe / isCleared 互為反面，未標記視為通關",
          page.evaluate("""() => {
              const a = {wipe:true}, b = {wipe:false}, c = {};
              return [isWipe(a), isCleared(a), isWipe(b), isWipe(c), isCleared(c)];
          }"""), [True, False, False, False, True])

    check("卡片預設顯示「通關」徽章且未按下",
          page.evaluate("""() => {
              const t = document.querySelector('.ptcard .wipetag');
              return [t.textContent.trim(), t.getAttribute('aria-pressed'),
                      t.classList.contains('on')];
          }"""), ["通關", "false", False])

    # 直接點徽章，確認是真的走事件委派而不是只有函式可用
    page.click(".ptcard .wipetag")
    page.wait_for_timeout(120)

    check("點徽章後資料與畫面同步變成翻車",
          page.evaluate("""() => {
              const t = document.querySelector('.ptcard .wipetag');
              return [ptsOf(curDate)[0].wipe, t.textContent.trim(),
                      t.getAttribute('aria-pressed'), t.classList.contains('on'),
                      document.querySelector('.ptcard').classList.contains('wiped')];
          }"""), [True, "翻車", "true", True, True])

    check("翻車標記有寫進 localStorage，不是只改了畫面",
          page.evaluate("""() => {
              flushPersist();
              const saved = JSON.parse(localStorage.getItem(KEY));
              return saved.schedule[curDate][0].wipe;
          }"""), True)

    check("只影響被點的那一場，同一天其他場不動",
          page.evaluate("() => ptsOf(curDate).map(p => !!p.wipe)"),
          page.evaluate("() => ptsOf(curDate).map((p,i) => i === 0)"))

    page.click(".ptcard .wipetag")
    page.wait_for_timeout(120)
    check("再點一次改回通關",
          page.evaluate("""() => {
              const t = document.querySelector('.ptcard .wipetag');
              return [ptsOf(curDate)[0].wipe, t.textContent.trim(),
                      document.querySelector('.ptcard').classList.contains('wiped')];
          }"""), [False, "通關", False])

    check("複製 RUN 不會把翻車標記帶到複本",
          page.evaluate("""() => {
              const src = ptsOf(curDate)[0];
              src.wipe = true;
              const before = ptsOf(curDate).length;
              document.querySelector('.ptcard [data-act="dupPt"]').click();
              const pts = ptsOf(curDate);
              return [pts.length === before + 1, pts[pts.length - 1].wipe, src.wipe];
          }"""), [True, False, True])

    # ---------- 翻車標記：匯出 ----------
    print("\n[wipe] 匯出圖片與 CSV 標示")
    seed_two_runs()
    page.evaluate("() => { ptsOf(curDate)[0].wipe = true; persist(); render(); }")
    page.wait_for_timeout(100)

    check("匯出節點只有翻車那一場帶標籤",
          page.evaluate("""() => {
              buildExportNode([curDate]);
              const cards = [...document.querySelectorAll('#exportHost .ex-pt')];
              const r = [cards.length > 1,
                         cards.map(c => !!c.querySelector('.ex-pt-w')),
                         cards.map(c => c.classList.contains('wiped'))];
              document.getElementById('exportHost').innerHTML = '';
              return r;
          }"""), [True, [True, False], [True, False]])

    check("匯出圖片的翻車樣式是寫死淺色，不會跟著深色模式翻掉",
          page.evaluate("""() => {
              const prev = document.documentElement.getAttribute('data-theme');
              document.documentElement.setAttribute('data-theme', 'dark');
              buildExportNode([curDate]);
              const tag = document.querySelector('#exportHost .ex-pt-w');
              const c = getComputedStyle(tag).color;
              document.getElementById('exportHost').innerHTML = '';
              if (prev) document.documentElement.setAttribute('data-theme', prev);
              else document.documentElement.removeAttribute('data-theme');
              return c;
          }"""), "rgb(185, 28, 28)")

    check("摘要列在有翻車時才印翻車數",
          page.evaluate("""() => {
              buildExportNode([curDate]);
              const withWipe = document.querySelector('#exportHost .ex-sub').textContent.includes('翻車 1');
              ptsOf(curDate)[0].wipe = false;
              buildExportNode([curDate]);
              const without = document.querySelector('#exportHost .ex-sub').textContent.includes('翻車');
              ptsOf(curDate)[0].wipe = true;
              document.getElementById('exportHost').innerHTML = '';
              return [withWipe, without];
          }"""), [True, False])

    check("CSV 多了結果欄，且逐列標出通關／翻車",
          page.evaluate("""() => {
              const rows = [['日期','星期','RUN','結果','時間','成員','職業','BUFF','便當','掉落物']];
              ptsOf(curDate).forEach(pt => pt.slots.forEach(s => {
                  const m = memberById(s.memberId);
                  if (m) rows.push([pt.name, isWipe(pt) ? '翻車' : '通關']);
              }));
              return [rows[0][3], rows[1][1], rows[rows.length - 1][1]];
          }"""), ["結果", "翻車", "通關"])

    # ---------- 翻車標記：材料頁明細 ----------
    print("\n[wipe] 場次明細標示")
    # 明細只列有掉落物的場次，所以把翻車標記換到有掉落的 ptC 上
    page.evaluate("""() => {
        ptsOf(curDate).forEach(p => { p.wipe = (p.id === 'ptC'); });
        persist(); render();
    }""")
    page.click('.tab[data-view="stats"]')
    page.wait_for_timeout(200)
    page.click('#matSeg button[data-sub="detail"]')
    page.wait_for_timeout(400)
    page.evaluate("() => { matOpenDays.add(curDate); renderMaterials(); }")
    page.wait_for_timeout(200)

    wiped_name = page.evaluate("() => ptsOf(curDate).find(isWipe).name")
    check("材料頁的場次明細會標出翻車那一場",
          page.evaluate("""() => {
              const runs = [...document.querySelectorAll('#matDetail .mrun')];
              const marked = runs.filter(r => r.querySelector('.mrun-w'));
              return [runs.length > 0, marked.length,
                      marked.map(r => r.querySelector('.mrun-n').textContent.trim())];
          }"""), [True, 1, [wiped_name]])

    page.click('.tab[data-view="board"]')
    page.wait_for_timeout(200)

    seed(page)

    # ---------- 出場統計 ----------
    print("\n[attend] 出場統計")

    def seed_attend():
        """三天、四場、三個人，翻車與出場次數各不相同，排行才驗得出來。"""
        seed(page)
        page.evaluate("""() => {
            state.members.push({id:'m4', name:'沒排到的人', active:true});
            state.dayTimes = {'2026-07-01':'21:00','2026-07-02':'21:00','2026-07-03':'21:00'};
            const mk = (id,name,wipe,ids) => ({id, name, capacity:12, wipe, videos:[], drops:[],
                                               slots: ids.map(x => ({memberId:x}))});
            state.schedule = {
              '2026-07-01':[ mk('a1','RUN 1', false, ['m1','m2','m3']) ],
              '2026-07-02':[ mk('b1','RUN 1', true,  ['m1','m2']),
                             mk('b2','RUN 2', false, ['m1','m3']) ],
              '2026-07-03':[ mk('c1','RUN 1', false, ['m1']) ]
            };
            curDate = '2026-07-03';
            attFrom = ''; attTo = '';
            persist(); render();
        }""")
        page.wait_for_timeout(150)

    seed_attend()

    check("統計把出場、通關、翻車分開算",
          page.evaluate("""() => {
              const s = attendanceStats('', '');
              const by = {};
              s.rows.forEach(r => by[memberName(r.memberId)] = [r.runs, r.cleared, r.wiped]);
              return [s.runs, s.wiped, s.days, by['小明'], by['小華'], by['小美']];
          }"""), [4, 1, 3, [4, 3, 1], [2, 1, 1], [2, 2, 0]])

    check("排行以成功場為準，跟之後的分潤順序一致",
          page.evaluate("""() => attendanceStats('','').rows.map(r => memberName(r.memberId))"""),
          ["小明", "小美", "小華"])

    check("同一場重複佔兩個位子只算一次（分潤是按份數分的）",
          page.evaluate("""() => {
              const pt = state.schedule['2026-07-03'][0];
              pt.slots.push({memberId:'m1'});
              const r = attendanceStats('2026-07-03','2026-07-03').rows
                          .find(x => x.memberId === 'm1');
              pt.slots.pop();
              return [r.runs, r.cleared];
          }"""), [1, 1])

    check("沒出場的成員不會出現在 rows 裡",
          page.evaluate("""() => attendanceStats('','').rows.some(r => r.memberId === 'm4')"""),
          False)

    check("日期區間會夾住統計範圍",
          page.evaluate("""() => {
              const s = attendanceStats('2026-07-02','2026-07-02');
              return [s.runs, s.wiped, s.days, s.rows.length];
          }"""), [2, 1, 1, 3])

    check("成員被刪掉之後，他的出場紀錄還原得出名字",
          page.evaluate("""() => {
              const keep = state.members;
              state.members = keep.filter(m => m.id !== 'm3');
              const n = memberName('m3');
              state.members = keep;
              return n;
          }"""), "（已刪除成員）")

    # --- 畫面 ---
    page.click('.tab[data-view="members"]')
    page.wait_for_timeout(200)
    page.click('#memberSeg [data-sub="mattend"]')
    page.wait_for_timeout(300)

    check("摘要卡先給場次規模，再給成功率",
          page.evaluate("""() => [
              document.querySelector('#attCard .attsum-t').textContent.trim(),
              document.querySelector('#attCard .attsum-r').textContent.trim()]"""),
          ["3 天 · 4 場", "75%"])

    check("每個出場的人一列，順序與統計一致",
          page.evaluate("""() => [...document.querySelectorAll('#attList .attrow-n')]
              .map(e => e.textContent.trim())"""),
          ["小明", "小美", "小華"])

    check("翻車 0 的人不掛翻車標籤",
          page.evaluate("""() => [...document.querySelectorAll('#attList .attrow')]
              .map(r => !!r.querySelector('.attpill.bad'))"""),
          [True, False, True])

    check("軌道長度是出場、以出場最多的人為基準",
          page.evaluate("""() => [...document.querySelectorAll('#attList .attrow-bar')]
              .map(b => b.style.width)"""),
          ["100%", "50%", "50%"])

    check("填滿的部分是通關，露出的尾巴就是翻車",
          page.evaluate("""() => [...document.querySelectorAll('#attList .attrow-fill')]
              .map(f => f.style.width)"""),
          ["75%", "100%", "50%"])

    check("沒出場的人另外列成缺席名單",
          page.evaluate("""() => {
              const a = document.querySelector('#attList .attabs');
              return [!!a, a.querySelector('b').textContent.trim(),
                      [...a.querySelectorAll('span')].map(s => s.textContent.trim())];
          }"""), [True, "1 人這段期間沒有出場", ["沒排到的人"]])

    # --- 篩選 ---
    page.click("#attFiltBtn")
    page.wait_for_timeout(150)
    page.fill("#attFrom", "2026-07-02")
    page.fill("#attTo", "2026-07-02")
    page.wait_for_timeout(300)

    check("改日期會重算並在收合狀態下標示出來",
          page.evaluate("""() => [
              document.getElementById('attFiltText').textContent.trim(),
              document.getElementById('attFiltBtn').classList.contains('on'),
              document.getElementById('attFiltClear').hidden,
              document.querySelector('#attCard .attsum-t').textContent.trim()]"""),
          ["07/02", True, False, "1 天 · 2 場"])

    page.click("#attFiltClear")
    page.wait_for_timeout(300)
    check("清除鈕一次回到全部日期",
          page.evaluate("""() => [attFrom, attTo,
              document.querySelector('#attCard .attsum-t').textContent.trim()]"""),
          ["", "", "3 天 · 4 場"])

    check("範圍內沒有場次時給空狀態而不是空白頁",
          page.evaluate("""() => {
              attFrom = '2030-01-01'; attTo = '2030-01-02'; renderAttend();
              const r = [!!document.querySelector('#attList .emptystate'),
                         document.getElementById('attCard').innerHTML.trim() === ''];
              attFrom = ''; attTo = ''; renderAttend();
              return r;
          }"""), [True, True])

    check("翻車標記改了之後，統計跟著變",
          page.evaluate("""() => {
              const before = attendanceStats('','').wiped;
              state.schedule['2026-07-03'][0].wipe = true;
              const after = attendanceStats('','');
              const m1 = after.rows.find(r => r.memberId === 'm1');
              state.schedule['2026-07-03'][0].wipe = false;
              return [before, after.wiped, m1.runs, m1.cleared, m1.wiped];
          }"""), [1, 2, 4, 2, 2])

    seed(page)

    # ---------- 分潤試算 ----------
    print("\n[split] 分潤試算")

    def seed_split():
        """一天兩場（成員不同）＋一天翻車場，才測得出歸屬與翻車規則。"""
        seed(page)
        page.evaluate("""() => {
            const mk = (id,name,wipe,ids) => ({id, name, capacity:12, wipe, videos:[], drops:[],
                                               slots: ids.map(x => ({memberId:x}))});
            state.schedule = {
              '2026-07-01':[ mk('r1','RUN 1', false, ['m1','m2']),
                             mk('r2','RUN 2', false, ['m2','m3']) ],
              '2026-07-02':[ mk('r3','RUN 1', true,  ['m1','m2','m3']) ]
            };
            state.dayTimes = {'2026-07-01':'21:00','2026-07-02':'21:00'};
            state.sales = [
              {id:'s1', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:1000, runIds:['r1'], items:[]},
              {id:'s2', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:600, runIds:['r2'], items:[]}
            ];
            curDate = '2026-07-02'; splFrom = ''; splTo = '';
            persist(); render();
        }""")
        page.wait_for_timeout(150)

    seed_split()

    check("綁定場次的收入只分給那場的人",
          page.evaluate("""() => {
              const st = splitStats('','');
              const by = {};
              st.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              return [st.totalTwd, by['小明'], by['小華'], by['小美']];
          }"""), [1600, 500, 800, 300])

    # 沒有公基金之後，這條不變式更嚴格：加總必須精確等於總收入
    check("每人金額加總 === 總收入",
          page.evaluate("() => splitStats('','','TWD').balanced"), True)

    check("未指定場次的舊交易，平均分攤給那天所有場次",
          page.evaluate("""() => {
              state.sales = [{id:'s9', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:1000, runIds:[], items:[]}];
              const st = splitStats('','');
              const by = {};
              st.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              return [by['小明'], by['小華'], by['小美'], st.balanced];
          }"""), [250, 500, 250, True])

    # 翻車就是沒打成功、沒有掉落物，沒有東西可以分——不是「先扣起來放公基金」。
    # 指到翻車場的錢會退回未歸屬，提醒使用者自己處理。
    check("指到翻車場的收入不進入分配，改列為未歸屬",
          page.evaluate("""() => {
              state.sales = [{id:'s9', date:'2026-07-02', mode:'set', cur:'TWD', sets:1,
                              price:900, runIds:['r3'], items:[]}];
              const st = splitStats('','','TWD');
              return [st.rows.length, st.totalTwd, st.unassignedCount,
                      st.unassignedTwd, st.balanced];
          }"""), [0, 0, 1, 900, True])

    # 掛不到任何場次的交易不併進任何期間，也不倒進公基金——
    # 那會讓某個期間莫名多出一筆錢。改成單獨列出來提醒使用者回去指定。
    check("那天沒有場次的交易列為未歸屬，不併進總額也不進公基金",
          page.evaluate("""() => {
              state.sales = [{id:'s9', date:'2026-12-25', mode:'set', cur:'TWD', sets:1,
                              price:500, runIds:[], items:[]}];
              const st = splitStats('','','TWD');
              return [st.unassignedCount, st.unassignedTwd, st.totalTwd,
                      st.rows.length, st.saleCount, st.balanced];
          }"""), [1, 500, 0, 0, 0, True])

    check("runId 指到已經被刪掉的場次時，退回當天平均分攤而不是整筆消失",
          page.evaluate("""() => {
              state.sales = [{id:'s9', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:1000, runIds:['已刪除的場次'], items:[]}];
              const st = splitStats('','','TWD');
              return [st.rows.length, st.totalTwd, st.balanced];
          }"""), [3, 1000, True])

    # 沒有公基金可以擺零頭，改用最大餘額法把差額一元一元發完
    check("除不盡時餘額發給人而不是留下來，加總精確等於總收入",
          page.evaluate("""() => {
              state.sales = [{id:'s9', date:'2026-07-01', mode:'set', cur:'TWD', sets:1,
                              price:1001, runIds:['r1'], items:[]}];
              const st = splitStats('','','TWD');
              const amts = st.rows.map(r => r.twd);
              return [amts.slice().sort((a,b) => b - a), amts.reduce((a,b) => a + b, 0),
                      st.totalTwd, st.balanced];
          }"""), [[501, 500], 1001, 1001, True])

    check("金額有小數時用分計算，不會出現浮點誤差把錢弄丟",
          page.evaluate("""() => {
              state.sales = [{id:'s9', date:'2026-07-01', mode:'set', cur:'TWD', sets:1,
                              price:0.03, runIds:['r1'], items:[]}];
              const st = splitStats('','','TWD');
              // 不足一元的零頭併給金額最高的人，加總仍精確等於 0.03
              return [st.rows.reduce((a,r) => a + r.twd, 0), st.totalTwd, st.balanced];
          }"""), [0.03, 0.03, True])

    check("大額除以奇數人時不會因為浮點誤差少算",
          page.evaluate("""() => {
              state.schedule['2026-07-01'][0].slots =
                  ['m1','m2','m3'].map(x => ({memberId:x}));
              state.sales = [{id:'s9', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:70000000, runIds:['r1'], items:[]}];
              const st = splitStats('','','TWD');
              state.schedule['2026-07-01'][0].slots =
                  ['m1','m2'].map(x => ({memberId:x}));
              const amts = st.rows.map(r => r.twd);
              return [amts.reduce((a,b) => a + b, 0),
                      amts.slice().sort((a,b) => b - a), st.balanced];
          }"""), [70000000, [23333334, 23333333, 23333333], True])
    # 每人被捨去 0.33 元共 0.99，加上場次層級除不盡剩的 0.01，公基金剛好 1 元

    check("日期區間會夾住分潤範圍",
          page.evaluate("""() => {
              state.sales = [
                {id:'a', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:1000, runIds:['r1'], items:[]},
                {id:'b', date:'2026-07-02', mode:'set', cur:'TWD', sets:1, price:900, runIds:['r3'], items:[]}];
              const st = splitStats('2026-07-01','2026-07-01','TWD');
              return [st.saleCount, st.totalTwd];
          }"""), [1, 1000])

    # --- 畫面 ---
    seed_split()
    page.click('.tab[data-view="auction"]')
    page.wait_for_timeout(250)
    page.click('#aucSeg [data-sub="asplit"]')
    page.wait_for_timeout(300)

    check("拍賣頁有兩個子分頁，成交紀錄在前",
          page.evaluate("""() => [...document.querySelectorAll('#aucSeg [data-sub]')]
              .map(b => [b.dataset.sub, b.textContent])"""),
          [["asales", "成交紀錄"], ["asplit", "分潤試算"]])

    check("摘要卡印出總收入、幾場有收入、幾人分潤",
          page.evaluate("""() => [
              document.querySelector('#splCard .attsum-r').textContent.trim(),
              document.querySelector('#splCard .attsum-t').textContent.trim(),
              [...document.querySelectorAll('#splCard .attsum-k b')].map(b => b.textContent.trim())]"""),
          ["1,600", "2 筆台幣交易 · 2 場有收入", ["0/3", "1,600"]])

    check("每人一列，金額由大到小",
          page.evaluate("""() => [...document.querySelectorAll('#splList .splrow')]
              .map(r => [r.querySelector('.attrow-n').textContent.trim(),
                         r.querySelector('.splamt').textContent.trim()])"""),
          [["小華", "800"], ["小明", "500"], ["小美", "300"]])

    # 公基金已經整個拿掉：收入全數分完，加總就是驗算方式
    check("畫面上不再出現公基金，改成聲明加總等於總收入",
          page.evaluate("""() => {
              const t = document.querySelector('#splCard').textContent;
              const sum = [...document.querySelectorAll('#splList .splamt')]
                  .reduce((a,e) => a + Number(e.textContent.replace(/,/g,'')), 0);
              return [t.includes('公基金'), t.includes('待發'), sum];
          }"""), [False, True, 1600])

    check("指到翻車場的收入會變成未歸屬警示，而不是靜靜進公基金",
          page.evaluate("""() => {
              state.sales.push({id:'sw', date:'2026-07-02', mode:'set', cur:'TWD', sets:1,
                                price:900, runIds:['r3'], items:[]});
              renderSplit();
              const w = document.querySelector('#splList .splwarn');
              const r = [!!w, w.textContent.includes('900'),
                         document.querySelector('#splCard').textContent.includes('公基金')];
              state.sales.pop(); renderSplit();
              return r;
          }"""), [True, True, False])

    check("有未歸屬的交易時，就算該期間沒收入也要講出來並說明怎麼修",
          page.evaluate("""() => {
              const keep = state.sales;
              // 記帳日當天沒有場次、又沒指定歸屬 —— 錢在那裡但掛不到任何期間
              state.sales = [{id:'u1', date:'2026-12-25', mode:'set', cur:'TWD', sets:1,
                              price:5000, runIds:[], items:[]}];
              splFrom = '2026-07-01'; splTo = '2026-07-31'; renderSplit();
              const w = document.querySelector('#splList .splwarn');
              const r = [!!w, w.textContent.includes('5,000'),
                         w.textContent.includes('歸屬場次'),
                         !!document.querySelector('#splList .emptystate')];
              state.sales = keep; splFrom = ''; splTo = ''; renderSplit();
              return r;
          }"""), [True, True, True, True])

    check("沒有交易時給空狀態並收起匯出鈕",
          page.evaluate("""() => {
              splFrom = '2030-01-01'; splTo = '2030-01-02'; renderSplit();
              const btn = document.getElementById('splShare');
              /* 只驗 .hidden 屬性會漏掉真正的問題：自訂 display 的元件
                 （.gbtn 是 inline-flex）會蓋掉瀏覽器預設的 [hidden]{display:none}，
                 屬性設了但按鈕還在畫面上。所以要量實際算出來的樣式。 */
              const r = [!!document.querySelector('#splList .emptystate'),
                         btn.hidden, getComputedStyle(btn).display];
              splFrom = ''; splTo = ''; renderSplit();
              return r;
          }"""), [True, True, "none"])

    # --- 匯出圖片 ---
    check("分潤圖把三個數字放在同一張圖上，加起來驗得起來",
          page.evaluate("""() => {
              buildSplitExportNode();
              const sum = [...document.querySelectorAll('#exportHost .ex-sp-sum b')]
                  .map(b => b.textContent.trim());
              const names = [...document.querySelectorAll('#exportHost .ex-sp-n')]
                  .map(e => e.textContent.trim());
              const foot = document.querySelectorAll('#exportHost .ex-sp-note').length;
              document.getElementById('exportHost').innerHTML = '';
              return [sum, names, foot];
          }"""), [["1,600", "2", "0/3"], ["小華", "小明", "小美"], 1])

    check("分潤圖的色值寫死淺色，深色模式下不會翻掉",
          page.evaluate("""() => {
              const prev = document.documentElement.getAttribute('data-theme');
              document.documentElement.setAttribute('data-theme', 'dark');
              buildSplitExportNode();
              const c = getComputedStyle(document.querySelector('#exportHost .ex-sp-a')).color;
              document.getElementById('exportHost').innerHTML = '';
              if (prev) document.documentElement.setAttribute('data-theme', prev);
              else document.documentElement.removeAttribute('data-theme');
              return c;
          }"""), "rgb(21, 23, 28)")

    # --- 歸屬場次欄位 ---
    page.click('#aucSeg [data-sub="asales"]')
    page.wait_for_timeout(250)

    # 回歸：原本只列「今天」的場次，賣出當天沒排場次就整個空的。
    # 材料是累積好幾天才一次賣掉的，清單必須跨天。
    check("場次清單會列出所有有場次的日子，不是只有今天",
          page.evaluate("""() => {
              saleRunIds = [];
              renderSaleRunOptions();
              document.querySelector('#saleRunPick [data-rp="btn"]').click();
              const days = [...document.querySelectorAll('#saleRunPick .rp-d')]
                  .map(e => e.textContent.trim());
              const runs = [...document.querySelectorAll('#saleRunPick .rp-n')]
                  .map(e => e.textContent.trim());
              return [days.length, runs.length, days[0]];
          }"""), [2, 3, "07/02 週四"])   # 新的日子排在最上面

    check("預設未指定，摘要說明會退回當天平均分攤",
          page.evaluate("""() => document.querySelector('#saleRunPick [data-rp="btn"]')
              .textContent.trim()"""), "未指定（當天平均分攤）")

    check("跨天勾選多場，摘要會標出場數與跨了幾天",
          page.evaluate("""() => {
              const cbs = [...document.querySelectorAll('#saleRunPick input[type="checkbox"]')];
              cbs[0].checked = true; cbs[0].dispatchEvent(new Event('change'));
              cbs[2].checked = true; cbs[2].dispatchEvent(new Event('change'));
              return [saleRunIds.length,
                      document.querySelector('#saleRunPick [data-rp="btn"]').textContent.trim()];
          }"""), [2, "已選 2 場 · 跨 2 天"])

    # 清單是新到舊，所以 cbs[0] 是 07/02 的場次、cbs[2] 是 07/01 的 RUN 2
    check("只選一場時摘要直接寫出日期與場次名",
          page.evaluate("""() => {
              const cbs = [...document.querySelectorAll('#saleRunPick input[type="checkbox"]')];
              cbs[0].checked = false; cbs[0].dispatchEvent(new Event('change'));
              return document.querySelector('#saleRunPick [data-rp="btn"]').textContent.trim();
          }"""), "07/01 RUN 2")

    check("翻車的場次照樣可選但會標出來（那場的材料還是賣得掉，只是分不到錢）",
          page.evaluate("""() => {
              state.schedule['2026-07-02'][0].wipe = true;
              document.querySelector('#saleRunPick [data-rp="btn"]').click();  // 收合
              document.querySelector('#saleRunPick [data-rp="btn"]').click();  // 重新展開才會重建
              const wiped = [...document.querySelectorAll('#saleRunPick .rp-r.wiped .rp-n')]
                  .map(e => e.textContent.trim());
              state.schedule['2026-07-02'][0].wipe = false;
              return wiped;
          }"""), ["RUN 1 · 翻車"])

    check("清除選擇一次清空",
          page.evaluate("""() => {
              document.querySelector('#saleRunPick [data-rp="clear"]').click();
              return [saleRunIds.length,
                      document.querySelector('#saleRunPick [data-rp="btn"]').textContent.trim()];
          }"""), [0, "未指定（當天平均分攤）"])

    check("已刪除的場次會從選擇中被濾掉，摘要不會出現對不到的數字",
          page.evaluate("""() => {
              saleRunIds = ['r1', '不存在的場次'];
              renderSaleRunOptions();
              return saleRunIds;
          }"""), ["r1"])

    check("一筆交易攤到多場時，每場再各自分給那場的人",
          page.evaluate("""() => {
              // r1 = 小明+小華，r2 = 小華+小美；1200 攤成兩場各 600，再各自對半分
              state.sales = [{id:'s1', date:'2026-07-01', mode:'set', cur:'TWD',
                              sets:1, price:1200, runIds:['r1','r2'], items:[]}];
              const st = splitStats('','','TWD');
              const by = {};
              st.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              return [by['小明'], by['小華'], by['小美'], st.totalTwd, st.balanced];
          }"""), [300, 600, 300, 1200, True])

    check("場次數算的是實際分到錢的場次，跟金額對得起來",
          page.evaluate("""() => {
              const st = splitStats('','','TWD');
              const by = {};
              st.rows.forEach(r => by[memberName(r.memberId)] = r.shares);
              return [by['小華'], by['小明']];
          }"""), [2, 1])

    # 區間篩的是「場次日期」不是「交易日期」：材料常常隔幾天才賣掉，
    # 讓記帳時間點決定那筆錢算哪個月是沒有道理的。
    check("07/02 賣掉 07/01 打的材料，算在 07/01 那一天",
          page.evaluate("""() => {
              state.sales = [{id:'s1', date:'2026-07-02', mode:'set', cur:'TWD',
                              sets:1, price:1000, runIds:['r1'], items:[]}];
              const onRunDay  = splitStats('2026-07-01','2026-07-01','TWD');
              const onSaleDay = splitStats('2026-07-02','2026-07-02','TWD');
              const by = {};
              onRunDay.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              return [onRunDay.totalTwd, by['小明'], by['小華'], onRunDay.balanced,
                      onSaleDay.totalTwd, onSaleDay.rows.length];
          }"""), [1000, 500, 500, True, 0, 0])

    check("未指定歸屬時，翻車場不吃掉那一份（其他場次照樣有掉落物）",
          page.evaluate("""() => {
              // 07-01 兩場都通關，先確認基準
              state.sales = [{id:'s1', date:'2026-07-01', mode:'set', cur:'TWD',
                              sets:1, price:1000, runIds:[], items:[]}];
              const both = splitStats('2026-07-01','2026-07-01','TWD');
              // 把 RUN 2 標成翻車：1000 應該全部給 RUN 1，而不是有一半進公基金
              state.schedule['2026-07-01'][1].wipe = true;
              const one = splitStats('2026-07-01','2026-07-01','TWD');
              const by = {};
              one.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              state.schedule['2026-07-01'][1].wipe = false;
              return [both.totalTwd, one.totalTwd, one.unassignedCount,
                      by['小明'], by['小華'], one.balanced];
          }"""), [1000, 1000, 0, 500, 500, True])

    # 選中的場次翻車 → 退回「當天其他通關場次」；當天沒有別場才會變成未歸屬
    check("選中的場次翻車時，錢退回當天其他通關的場次",
          page.evaluate("""() => {
              state.schedule['2026-07-01'][1].wipe = true;
              state.sales = [{id:'s1', date:'2026-07-01', mode:'set', cur:'TWD',
                              sets:1, price:900, runIds:['r2'], items:[]}];
              const st = splitStats('2026-07-01','2026-07-01','TWD');
              const by = {};
              st.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              state.schedule['2026-07-01'][1].wipe = false;
              // r1（小明+小華）是當天唯一還通關的場次
              return [st.rows.length, by['小明'], by['小華'],
                      st.unassignedCount, st.balanced];
          }"""), [2, 450, 450, 0, True])

    check("攤到多場除不盡時一分一分發完，不會有分數消失",
          page.evaluate("""() => {
              // 1000.01 元 = 100001 分，攤到 2 場：50001 / 50000
              state.sales = [{id:'s1', date:'2026-07-01', mode:'set', cur:'TWD',
                              sets:1, price:1000.01, runIds:['r1','r2'], items:[]}];
              const st = splitStats('2026-07-01','2026-07-01','TWD');
              return [st.totalTwd, st.balanced,
                      st.rows.reduce((a,r) => a + r.twd, 0)];
          }"""), [1000.01, True, 1000.01])

    # --- 編輯既有交易：修正歸屬場次 ---
    check("編輯交易時用的是同一個跨天複選器，並帶出原本選的場次",
          page.evaluate("""() => {
              state.sales = [{id:'e1', date:'2026-07-02', mode:'set', cur:'TWD',
                              sets:1, price:900, runIds:['r1'], items:[]}];
              persist(); renderSales();
              document.querySelector('#saleList [data-act="editSale"]').click();
              const btn = document.querySelector('#editRunPick [data-rp="btn"]');
              return [!!btn, btn.textContent.trim()];
          }"""), [True, "07/01 RUN 1"])

    check("改完場次按儲存會寫回 runIds",
          page.evaluate("""() => {
              document.querySelector('#editRunPick [data-rp="btn"]').click();
              const cbs = [...document.querySelectorAll('#editRunPick input[type="checkbox"]')];
              cbs.forEach(cb => { if (!cb.checked) { cb.checked = true;
                                                     cb.dispatchEvent(new Event('change')); } });
              document.querySelector('.sheet [data-s="save"]').click();
              return state.sales[0].runIds.length;
          }"""), 3)

    check("按取消不會動到已存的紀錄",
          page.evaluate("""() => {
              const before = state.sales[0].runIds.slice();
              document.querySelector('#saleList [data-act="editSale"]').click();
              document.querySelector('#editRunPick [data-rp="btn"]').click();
              const cb = document.querySelector('#editRunPick input[type="checkbox"]');
              cb.checked = false; cb.dispatchEvent(new Event('change'));
              document.querySelector('.sheet [data-s="cancel"]').click();
              return [before.length, state.sales[0].runIds.length];
          }"""), [3, 3])

    check("修正後的歸屬立刻反映到分潤上",
          page.evaluate("""() => {
              const before = splitStats('','','TWD').rows.length;
              state.sales[0].runIds = ['r1'];
              const after = splitStats('','','TWD');
              const by = {};
              after.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              return [before, after.rows.length, by['小明'], by['小華'], after.balanced];
          }"""), [3, 2, 450, 450, True])

    # 回報情境：一天五場，只有一場翻車且沒掉落物，其他四場都成功。
    # 那一場不該吃掉五分之一的收入。
    check("一天五場只有一場翻車：收入只攤給四場通關，那一場不吃份",
          page.evaluate("""() => {
              const mk = (id,n,w,ids) => ({id, name:n, capacity:12, wipe:w, videos:[], drops:[],
                                           slots: ids.map(x => ({memberId:x}))});
              state.schedule = {'2026-06-10':[
                  mk('f1','RUN 1', false, ['m1','m2']), mk('f2','RUN 2', false, ['m1','m3']),
                  mk('f3','RUN 3', true,  ['m2','m3']),          // 翻車、沒掉落物
                  mk('f4','RUN 4', false, ['m1','m2']), mk('f5','RUN 5', false, ['m2','m3'])]};
              state.sales = [{id:'s1', date:'2026-06-10', mode:'set', cur:'TWD',
                              sets:1, price:5000, runIds:[], items:[]}];
              const st = splitStats('2026-06-10','2026-06-10','TWD');
              const by = {};
              st.rows.forEach(r => by[memberName(r.memberId)] = r.twd);
              return [st.totalTwd, st.unassignedCount,
                      by['小明'], by['小華'], by['小美'], st.balanced];
          }"""),
          # 5000 ÷ 4 場 = 1250/場；小明在 f1,f2,f4 → 1875，小華在 f1,f4,f5 → 1875，小美在 f2,f5 → 1250
          [5000, 0, 1875, 1875, 1250, True])

    # 五場全翻 → 未指定歸屬時找不到任何通關場次 → 整筆變成「未歸屬」，
    # 不會被塞進公基金充數。使用者可以自己決定要不要手動指定到翻車場。
    check("五場全部翻車時，未指定歸屬的收入會列為未歸屬並提醒",
          page.evaluate("""() => {
              state.schedule['2026-06-10'].forEach(pt => pt.wipe = true);
              const st = splitStats('2026-06-10','2026-06-10','TWD');
              return [st.rows.length, st.totalTwd,
                      st.unassignedCount, st.unassignedTwd, st.balanced];
          }"""), [0, 0, 1, 5000, True])

    # schemaVersion:7 的資料還是舊欄位名（twd/rate），要一路跑過 8→9 與 9→10
    check("7→10 全鏈：補 runId、換成 cur/price、再包成 runIds 陣列",
          page.evaluate("""() => {
              const old = {schemaVersion:7, members:[], roles:[], dayTimes:{}, schedule:{},
                  sales:[{id:'x', date:'2026-01-01', mode:'set', sets:1, twd:100, rate:2, items:[]},
                         {id:'y', date:'2026-01-02', mode:'set', sets:1, twd:50, rate:2,
                          runId:'r9', items:[]}]};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [m.sales[0].cur, m.sales[0].price,
                      Array.isArray(m.sales[0].runIds), m.sales[0].runIds.length,
                      m.sales[1].runIds, m.sales[0].runId === undefined,
                      m.schemaVersion === SCHEMA_VERSION];
          }"""), ["TWD", 100, True, 0, ["r9"], True, True])

    seed(page)

    check("更新紀錄的最新一筆與 APP_VERSION 一致",
          page.evaluate("() => [CHANGELOG[0].v, APP_VERSION, CHANGELOG[0].v === APP_VERSION]")[2],
          True)

    check("更新紀錄沒有跳號或重複，版本由新到舊",
          page.evaluate("""() => {
              const nums = CHANGELOG.map(e => Number(e.v.replace('v','')));
              const sorted = nums.every((n,i) => i === 0 || nums[i-1] > n);
              return [sorted, new Set(nums).size === nums.length];
          }"""), [True, True])

    check("每一筆更新紀錄都有日期與至少一條變更，標籤都是合法的",
          page.evaluate("""() => {
              const ok = ['add','fix','imp','chg','rm'];
              return CHANGELOG.every(e => /^[0-9]{4}\\/[0-9]{2}\\/[0-9]{2}$/.test(e.d)
                  && Array.isArray(e.c) && e.c.length > 0
                  && e.c.every(([tag, txt]) => ok.includes(tag) && txt.length > 0));
          }"""), True)

    check("這一輪新增的版本都補進更新紀錄了",
          page.evaluate("""() => {
              const have = new Set(CHANGELOG.map(e => e.v));
              return ['v53','v54','v55','v56','v57','v59','v60'].filter(v => !have.has(v));
          }"""), [])

    # ---------- 領取紀錄 ----------
    print("\n[payout] 分潤領取標記")
    seed_split()
    page.evaluate("""() => {
        state.sales = [{id:'s1', date:'2026-07-01', mode:'set', cur:'TWD',
                        sets:1, price:1000, runIds:['r1'], items:[]}];
        state.payouts = []; splFrom = ''; splTo = ''; aucCur = 'TWD';
        persist(); render();
    }""")
    page.click('.tab[data-view="auction"]')
    page.wait_for_timeout(250)
    page.click('#aucSeg [data-sub="asplit"]')
    page.wait_for_timeout(350)

    check("10→11 遷移補上空的領取紀錄清單",
          page.evaluate("""() => {
              const old = {schemaVersion:10, members:[], roles:[], schedule:{}, dayTimes:{}, sales:[]};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [Array.isArray(m.payouts), m.payouts.length,
                      m.schemaVersion === SCHEMA_VERSION];
          }"""), [True, 0, True])

    check("預設沒有人領過，摘要顯示待發等於總收入",
          page.evaluate("""() => [
              [...document.querySelectorAll('#splCard .attsum-k b')].map(b => b.textContent.trim()),
              [...document.querySelectorAll('#splList .paidbtn')].map(b => b.textContent.trim())]"""),
          [["0/2", "1,000"], ["標記已領", "標記已領"]])

    page.locator("#splList .paidbtn").first.click()
    page.wait_for_timeout(300)

    check("標記已領記下的是當下還差的金額",
          page.evaluate("""() => {
              const p = state.payouts[0];
              return [state.payouts.length, p.cur, p.from, p.to, p.twd,
                      p.memberId === splitStats('','','TWD').rows[0].memberId];
          }"""), [1, "TWD", "", "", 500, True])

    check("領完的那一列會標起來，待領歸零，摘要跟著更新",
          page.evaluate("""() => [
              document.querySelector('#splList .splrow').classList.contains('paid'),
              document.querySelector('#splList .paidbtn').textContent.trim(),
              document.querySelector('#splList .splamt').textContent.trim(),
              [...document.querySelectorAll('#splCard .attsum-k b')].map(b => b.textContent.trim())]"""),
          [True, "✓ 已領", "0", ["1/2", "500"]])

    page.locator("#splList .paidbtn").nth(1).click()
    page.wait_for_timeout(300)
    check("全部發完會另外提示",
          page.evaluate("""() => [
              !!document.querySelector('#splCard .splnote.done'),
              document.querySelector('#splCard .splnote.done').textContent.includes('發完')]"""),
          [True, True])

    check("再點一次可以取消標記",
          page.evaluate("""() => {
              document.querySelector('#splList .paidbtn').click();
              return [state.payouts.length,
                      document.querySelector('#splList .splrow').classList.contains('paid')];
          }"""), [1, False])

    # 這是這一版的重點：窄期間發過的錢，在更大的期間裡要被扣掉，
    # 而不是重新顯示一次全額。
    check("窄期間發過的錢，在更大的期間裡會被扣掉",
          page.evaluate("""() => {
              state.payouts = [];
              // 只結算 07-01 那一天，先發掉一半
              splFrom = '2026-07-01'; splTo = '2026-07-01'; renderSplit();
              const dayDue = splitStats(splFrom, splTo, 'TWD').rows[0];
              togglePayout(dayDue.memberId, dayDue.twd);
              // 換成全部日期：同一個人應該只剩下差額
              splFrom = ''; splTo = ''; renderSplit();
              const all = splitStats('', '', 'TWD').rows
                  .find(r => r.memberId === dayDue.memberId);
              const got = paidAmount(dayDue.memberId, '', '', 'TWD');
              const shown = [...document.querySelectorAll('#splList .splrow')]
                  .find(el => el.querySelector('.attrow-n').textContent.trim()
                              === memberName(dayDue.memberId))
                  .querySelector('.splamt').textContent.trim();
              return [dayDue.twd, got, all.twd, shown];
          }"""), [500, 500, 500, "0"])

    check("領到一半的人，列上寫得出應得與已領",
          page.evaluate("""() => {
              state.payouts = [];
              const r = splitStats('', '', 'TWD').rows[0];
              // 手動塞一筆只發了 200 的紀錄
              state.payouts.push({id:'p1', memberId:r.memberId, from:'', to:'',
                                  cur:'TWD', twd:200, ts:Date.now()});
              renderSplit();
              const row = [...document.querySelectorAll('#splList .splrow')]
                  .find(el => el.querySelector('.attrow-n').textContent.trim()
                              === memberName(r.memberId));
              const pills = [...row.querySelectorAll('.attpill')].map(e => e.textContent.trim());
              return [row.querySelector('.splamt').textContent.trim(),
                      pills.some(t => t.includes('應得 500') && t.includes('已領 200')),
                      row.classList.contains('paid')];
          }"""), ["300", True, False])

    check("摘要的待發是扣掉已領之後的總額",
          page.evaluate("""() => [...document.querySelectorAll('#splCard .attsum-k b')]
              .map(b => b.textContent.trim())"""), ["0/2", "800"])

    check("發錢之後才補記交易，差額會自動變成新的待領",
          page.evaluate("""() => {
              state.payouts = [];
              const r = splitStats('', '', 'TWD').rows[0];
              togglePayout(r.memberId, r.twd);                 // 先照 500 發完
              state.sales.push({id:'s2', date:'2026-07-01', mode:'set', cur:'TWD',
                                sets:1, price:500, runIds:['r1'], items:[]});
              renderSplit();
              const after = splitStats('', '', 'TWD').rows
                  .find(x => x.memberId === r.memberId);
              const kept = state.payouts[0].twd;               // 實際發出去的不該被改寫
              const due = after.twd - paidAmount(r.memberId, '', '', 'TWD');
              state.sales.pop(); renderSplit();
              return [r.twd, kept, after.twd, due];
          }"""), [500, 500, 750, 250])

    check("已領那一列的標籤與按鈕會換行，不會擠成一團",
          page.evaluate("""() => {
              state.payouts = [];
              /* 用實際會遇到的數量級：「應得 50,000,000 · 已領 30,000,000」
                 這種標籤加上按鈕，在手機寬度下一行絕對放不完。 */
              const keep = state.sales;
              state.sales = [{id:'big', date:'2026-07-01', mode:'set', cur:'TWD',
                              sets:1, price:100000000, runIds:['r1'], items:[]}];
              const r = splitStats('', '', 'TWD').rows[0];
              state.payouts.push({id:'p1', memberId:r.memberId, from:'', to:'',
                                  cur:'TWD', twd:30000000, ts:Date.now()});
              renderSplit();
              const row = [...document.querySelectorAll('#splList .splrow')]
                  .find(el => el.querySelector('.attrow-n').textContent.trim()
                              === memberName(r.memberId));
              const sub = row.querySelector('.attrow-sub');
              const kids = [...sub.children];
              const wrap = getComputedStyle(sub).flexWrap;
              /* 真正的換行判準是「按鈕的上緣落在第一顆標籤的下緣之後」。
                 不能用子元素 top 是否相同 —— 標籤與按鈕高度本來就不一樣，
                 align-items:center 會讓它們在同一行也有不同的 top。
                 也不能用 scrollWidth 比 clientWidth：按鈕補觸控範圍的 ::after
                 刻意往左右各突出 6px，本來就會把 scrollWidth 撐大。 */
              /* 測試視窗比手機寬，照原樣量會擠得下、測不出東西。
                 把容器壓到手機那一列實際可用的寬度再量，才是真的在測
                 「空間不夠的時候會不會換行」。 */
              sub.style.maxWidth = '240px';
              const first = kids[0].getBoundingClientRect();
              const btn = sub.querySelector('.paidbtn').getBoundingClientRect();
              const wrapped = btn.top >= first.bottom;
              sub.style.maxWidth = '';
              state.payouts = []; state.sales = keep; renderSplit();
              return [wrap, kids.length >= 3, wrapped];
          }"""), ["wrap", True, True])

    check("匯出圖印的是待領金額，領完的人標出來",
          page.evaluate("""() => {
              state.payouts = [];
              const r = splitStats('', '', 'TWD').rows[0];
              togglePayout(r.memberId, r.twd);
              buildSplitExportNode();
              const sum = [...document.querySelectorAll('#exportHost .ex-sp-sum b')]
                  .map(b => b.textContent.trim());
              const amts = [...document.querySelectorAll('#exportHost .ex-sp-a')]
                  .map(e => e.textContent.trim());
              const done = document.querySelectorAll('#exportHost .ex-sp-p').length;
              document.getElementById('exportHost').innerHTML = '';
              state.payouts = []; renderSplit();
              return [sum[2], amts, done];
          }"""), ["1/2", ["0", "500"], 1])

    check("跟目前期間只有部分重疊的結算不扣除，但要標示出來",
          page.evaluate("""() => {
              state.payouts = [{id:'p1', memberId:'m1', from:'2026-06-25', to:'2026-07-01',
                                cur:'TWD', twd:300, ts:Date.now()}];
              // 目前期間 07-01～07-31 只蓋到那次結算的一半，無法判斷該扣多少
              const partial = partialPayouts('m1','2026-07-01','2026-07-31','TWD').length;
              const deducted = paidAmount('m1','2026-07-01','2026-07-31','TWD');
              // 完整包含就會扣
              const inside = paidAmount('m1','2026-06-01','2026-07-31','TWD');
              state.payouts = [];
              return [partial, deducted, inside];
          }"""), [1, 0, 300])

    check("扣除只認同一種幣別的結算",
          page.evaluate("""() => {
              state.payouts = [{id:'p1', memberId:'m1', from:'', to:'',
                                cur:'R', twd:900, ts:Date.now()}];
              const r = [paidAmount('m1','','','TWD'), paidAmount('m1','','','R')];
              state.payouts = [];
              return r;
          }"""), [0, 900])

    # ---------- 材料：扣除已售出 ----------
    print("\n[material] 可組成組數扣除已售出")
    seed(page)

    def set_recipe_stock(qty, sold_sets=0, sold_items=None):
        return page.evaluate("""([qty, soldSets, soldItems]) => {
            state.schedule = {'2026-06-10':[{id:'g1', name:'RUN 1', capacity:12, wipe:false,
                videos:[], slots:[], drops: SET_RECIPE.map((n,i) => ({id:'d'+i, name:n, qty}))}]};
            state.dayTimes = {'2026-06-10':'21:00'};
            state.sales = [];
            if (soldSets > 0)
                state.sales.push({id:'ss', date:'2026-06-10', mode:'set', cur:'TWD',
                                  sets:soldSets, price:100, runIds:['g1'], items:[]});
            if (soldItems)
                state.sales.push({id:'si', date:'2026-06-10', mode:'item', cur:'TWD',
                                  sets:0, price:0, runIds:['g1'],
                                  items:[{name:SET_RECIPE[0], qty:soldItems, price:10}]});
            matFrom = ''; matTo = ''; matPerSet = 1;
            persist(); renderMaterials();
            return [curSets, document.querySelector('#matCards .mres-v').textContent.trim()];
        }""", [qty, sold_sets, sold_items])

    check("沒賣過時，可組成組數等於掉落算出來的組數",
          set_recipe_stock(10), [10, "10組"])

    check("賣掉 4 組之後只剩 6 組，不會再帶入舊的 10",
          set_recipe_stock(10, sold_sets=4), [6, "6組"])

    check("單品賣掉的材料也會扣，瓶頸跟著改變",
          set_recipe_stock(10, sold_items=7), [3, "3組"])

    check("結果卡寫出扣除過程，數字不會憑空變小",
          page.evaluate("""() => {
              const t = document.querySelector('#matCards .mres-sold');
              return [!!t, t.textContent.replace(/\s+/g,' ').trim()];
          }"""), [True, "掉落夠組 10 組，已售出 7 個單品，扣掉之後還能組 3 組"])

    check("同時賣了整組與單品時，兩種都寫出來",
          page.evaluate("""() => {
              state.sales = [
                {id:'a', date:'2026-06-10', mode:'set', cur:'TWD', sets:2, price:100,
                 runIds:['g1'], items:[]},
                {id:'b', date:'2026-06-10', mode:'item', cur:'TWD', sets:0, price:0,
                 runIds:['g1'], items:[{name:SET_RECIPE[0], qty:3, price:10}]}];
              renderMaterials();
              return [curSets, document.querySelector('#matCards .mres-sold')
                  .textContent.replace(/\\s+/g,' ').trim()];
          }"""),
          [5, "掉落夠組 10 組，已售出 2 組與 3 個單品，扣掉之後還能組 5 組"])

    check("瓶頸列印的是扣除後的剩餘量，跟「再 N 個進下一組」對得起來",
          page.evaluate("""() => {
              state.sales = [{id:'ss', date:'2026-06-10', mode:'set', cur:'TWD',
                              sets:5, price:100, runIds:['g1'], items:[]}];
              state.schedule['2026-06-10'][0].drops =
                  SET_RECIPE.map((n,i) => ({id:'d'+i, name:n, qty:16}));
              matPerSet = 3; matFrom = ''; matTo = ''; renderMaterials();
              const nv = document.querySelector('#matCards .mres-nv').textContent.trim();
              matPerSet = 1;
              // 16 掉落 − 5 組×3 = 剩 1 個，每組要 3 個 → 可組 0 組、再 2 個進下一組
              return [curSets, nv];
          }"""), [0, "1 個 · 再 2 個進下一組"])

    # 回報情境：成交紀錄只顯示目前幣別，材料頁兩種都算，
    # 同一批貨兩種幣別各記一次就會剛好變成兩倍，而畫面上看不出來。
    check("兩種幣別都有整組售出時，會拆開標示各賣了幾組",
          page.evaluate("""() => {
              state.schedule['2026-06-10'][0].drops =
                  SET_RECIPE.map((n,i) => ({id:'d'+i, name:n, qty:500}));
              state.sales = [
                {id:'a', date:'2026-06-10', mode:'set', cur:'TWD', sets:116, price:100,
                 runIds:['g1'], items:[]},
                {id:'b', date:'2026-06-10', mode:'set', cur:'R', sets:116, price:100,
                 runIds:['g1'], items:[]}];
              matPerSet = 1; matFrom = ''; matTo = ''; renderMaterials();
              const t = document.querySelector('#matCards .mres-sold')
                  .textContent.replace(/\\s+/g,' ').trim();
              return [curSets, t.includes('已售出 232 組（台幣 116 組 · R 幣 116 組）'),
                      !!document.querySelector('#matCards .mres-sold-hint')];
          }"""), [268, True, True])

    check("只有一種幣別時不多印那段拆解，避免變成噪音",
          page.evaluate("""() => {
              state.sales = [{id:'a', date:'2026-06-10', mode:'set', cur:'TWD', sets:116,
                              price:100, runIds:['g1'], items:[]}];
              renderMaterials();
              const t = document.querySelector('#matCards .mres-sold')
                  .textContent.replace(/\\s+/g,' ').trim();
              return [curSets, t.includes('台幣'),
                      !!document.querySelector('#matCards .mres-sold-hint')];
          }"""), [384, False, False])

    check("賣超過庫存不會算出負的組數",
          set_recipe_stock(3, sold_sets=99), [0, "0組"])

    check("材料頁的日期篩選也會夾住已售出的認定",
          page.evaluate("""() => {
              state.sales = [{id:'ss', date:'2026-06-10', mode:'set', cur:'TWD',
                              sets:4, price:100, runIds:['g1'], items:[]}];
              state.schedule['2026-06-10'][0].drops =
                  SET_RECIPE.map((n,i) => ({id:'d'+i, name:n, qty:10}));
              matFrom = ''; matTo = ''; renderMaterials();
              const all = curSets;
              // 換到一段不含那場的期間：掉落與售出都不算，組數歸零
              matFrom = '2026-05-01'; matTo = '2026-05-31'; renderMaterials();
              const other = curSets;
              matFrom = ''; matTo = ''; renderMaterials();
              return [all, other];
          }"""), [6, 0])

    check("交易的期間認定與分潤同一套（認歸屬場次的日期）",
          page.evaluate("""() => {
              // 交易記在 09/04，但歸屬到 06/10 的場次
              state.sales = [{id:'ss', date:'2026-09-04', mode:'set', cur:'TWD',
                              sets:4, price:100, runIds:['g1'], items:[]}];
              matFrom = '2026-06-01'; matTo = '2026-06-30'; renderMaterials();
              const byRun = curSets;
              matFrom = ''; matTo = ''; renderMaterials();
              return byRun;
          }"""), 6)

    seed(page)

    # ---------- 日期快捷鈕選中狀態 ----------
    print("\n[preset] 日期快捷鈕")

    check("按下本月會把那顆標起來，其他三顆不亮",
          page.evaluate("""() => {
              applySplPreset('month');
              return [...document.querySelectorAll('#splFiltBody [data-splpreset]')]
                  .map(b => [b.dataset.splpreset, b.classList.contains('on'),
                             b.getAttribute('aria-pressed')]);
          }"""),
          [["today", False, "false"], ["week", False, "false"],
           ["month", True, "true"], ["all", False, "false"]])

    check("手動挑一段不對應任何快捷鈕的日期時，四顆都不亮",
          page.evaluate("""() => {
              splFrom = '2026-03-03'; splTo = '2026-03-09'; renderSplit();
              const on = [...document.querySelectorAll('#splFiltBody [data-splpreset].on')].length;
              splFrom = ''; splTo = ''; renderSplit();
              return on;
          }"""), 0)

    check("清空日期等於「全部」，那一顆會亮",
          page.evaluate("""() => document.querySelector('#splFiltBody [data-splpreset="all"]')
              .classList.contains('on')"""), True)

    check("四個篩選面板吃同一套快捷鈕邏輯",
          page.evaluate("""() => {
              const t = todayKey();
              return [presetRange('today')[0] === t, matchPreset(t, t),
                      matchPreset('', ''), matchPreset('2026-03-03', '2026-03-09')];
          }"""), [True, "today", "all", None])

    check("材料頁與成交紀錄的快捷鈕也會標示選中",
          page.evaluate("""() => {
              applyMatPreset('week');  applyAucPreset('today');
              const pick = (sel, attr) => [...document.querySelectorAll(`${sel} [data-${attr}].on`)]
                  .map(b => b.dataset[attr]);
              const r = [pick('#matFiltBody','preset'), pick('#aucFiltBody','aucpreset')];
              applyMatPreset('all'); applyAucPreset('all');
              return r;
          }"""), [["week"], ["today"]])

    check("出場統計的快捷鈕同樣會標示",
          page.evaluate("""() => {
              applyAttPreset('month');
              const on = [...document.querySelectorAll('#attFiltBody [data-preset].on')]
                  .map(b => b.dataset.preset);
              applyAttPreset('all');
              return on;
          }"""), ["month"])

    seed(page)

    # ---------- 幣別拆分 ----------
    print("\n[cur] 台幣／R 幣拆分")
    seed(page)
    page.evaluate("""() => {
        state.sales = [
          {id:'t1', date:'2026-07-01', mode:'set', cur:'TWD', sets:2, price:1000, runIds:[], items:[]},
          {id:'t2', date:'2026-07-02', mode:'set', cur:'TWD', sets:1, price:1500, runIds:[], items:[]},
          {id:'r1', date:'2026-07-01', mode:'set', cur:'R',   sets:1, price:80000000, runIds:[], items:[]}];
        aucCur = 'TWD'; aucFrom = ''; aucTo = ''; splFrom = ''; splTo = '';
        persist(); render();
    }""")
    page.click('.tab[data-view="auction"]')
    page.wait_for_timeout(350)

    check("8→9 遷移把 twd/rate 換成 cur/price，換算率不保留",
          page.evaluate("""() => {
              const old = {schemaVersion:8, members:[], roles:[], schedule:{}, dayTimes:{},
                  sales:[{id:'z', date:'2026-01-01', mode:'set', sets:3, twd:100, rate:2, runIds:[],
                          items:[]},
                         {id:'y', date:'2026-01-02', mode:'item', sets:0, twd:0, rate:2, runIds:[],
                          items:[{name:'威力隕石碎片', qty:5, twd:10}]}]};
              const m = migrate(JSON.parse(JSON.stringify(old)));
              return [m.sales[0].cur, m.sales[0].price, m.sales[0].twd === undefined,
                      m.sales[0].rate === undefined,
                      m.sales[1].items[0].price, m.sales[1].items[0].twd === undefined];
          }"""), ["TWD", 100, True, True, 10, True])

    check("成交紀錄只列出目前幣別的交易",
          page.evaluate("""() => [...document.querySelectorAll('#saleList .auccard .auc-t')]
              .map(e => e.textContent.trim())"""),
          ["1,500", "2,000"])

    check("統計卡的金額只加總目前幣別",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat')]
              .map(c => [c.querySelector('.stat-k').textContent,
                         c.querySelector('.stat-v').textContent])
              .find(([k]) => k === '累計總額')[1]"""), "3,500")

    check("換算率那張卡已經不存在了",
          page.evaluate("""() => [...document.querySelectorAll('#saleCards .stat-k')]
              .map(e => e.textContent).includes('累計總 R 幣')"""), False)

    # --- 切到 R 幣 ---
    page.click('#aucCurSeg [data-cur="R"]')
    page.wait_for_timeout(350)

    check("切幣別後整頁跟著換：紀錄、統計、欄位標籤",
          page.evaluate("""() => [
              aucCur,
              [...document.querySelectorAll('#saleList .auccard .auc-t')].map(e => e.textContent.trim()),
              [...document.querySelectorAll('#saleCards .stat-k')].map(e => e.textContent)
                  .filter(t => t.startsWith('累計總額')),
              document.getElementById('salePriceLabel').textContent.trim(),
              [...document.querySelectorAll('#aucCurSeg [data-cur]')]
                  .map(b => b.getAttribute('aria-selected'))]"""),
          ["R", ["80,000,000"], ["累計總額"], "每組價格（R 幣）", ["false", "true"]])

    check("成交卡片的單位標的是那筆自己的幣別",
          page.evaluate("""() => document.querySelector('#saleList .auccard .auc-u').textContent.trim()"""),
          "R 幣")

    # 切幣別時 salePrice 會被清成 null，接著由 renderSales 重新沿用「該幣別」上一筆的價格。
    # 重點不是欄位變空，而是絕不能留著台幣的數字——那會記成一筆差好幾個數量級的 R 幣交易。
    check("切幣別後每組價格重新沿用該幣別上一筆，不會殘留台幣數字",
          page.evaluate("() => document.getElementById('salePrice').value"), "80000000")

    check("新記錄的交易帶的是目前選的幣別",
          page.evaluate("""() => {
              document.getElementById('saleSets').value = '2';
              salePrice = '5000000'; saleSets = '2';
              document.getElementById('saleAdd').click();
              const s = state.sales[state.sales.length - 1];
              state.sales.pop(); persist();
              return [s.cur, s.price, s.sets];
          }"""), ["R", 5000000, 2])

    # --- 分潤跟著幣別走 ---
    page.evaluate("""() => {
        const mk = (id,name,ids) => ({id, name, capacity:12, wipe:false, videos:[], drops:[],
                                      slots: ids.map(x => ({memberId:x}))});
        state.schedule = {'2026-07-01':[ mk('r1','RUN 1', ['m1','m2']) ]};
        state.sales = [
          {id:'t1', date:'2026-07-01', mode:'set', cur:'TWD', sets:1, price:1000, runIds:['r1'], items:[]},
          {id:'x1', date:'2026-07-01', mode:'set', cur:'R',   sets:1, price:60000000, runIds:['r1'], items:[]}];
        persist(); render();
    }""")
    page.wait_for_timeout(200)

    check("兩種幣別各自成池，不會混在一起分",
          page.evaluate("""() => {
              const t = splitStats('','','TWD'), r = splitStats('','','R');
              return [t.totalTwd, t.rows.map(x => x.twd), t.balanced,
                      r.totalTwd, r.rows.map(x => x.twd), r.balanced];
          }"""), [1000, [500, 500], True, 60000000, [30000000, 30000000], True])

    check("分潤頁顯示的是目前幣別的池子",
          page.evaluate("""() => {
              aucCur = 'R'; renderSplit();
              const a = document.querySelector('#splCard .attsum-r').textContent.trim();
              aucCur = 'TWD'; renderSplit();
              const b = document.querySelector('#splCard .attsum-r').textContent.trim();
              return [a, b];
          }"""), ["60,000,000", "1,000"])

    check("分潤圖的標題標明幣別，貼到群組不會被誤讀",
          page.evaluate("""() => {
              aucCur = 'R'; buildSplitExportNode();
              const h = document.querySelector('#exportHost .ex-h').textContent.trim();
              document.getElementById('exportHost').innerHTML = '';
              aucCur = 'TWD'; renderSplit();
              return h.includes('R 幣');
          }"""), True)

    # ---------- 效能結構：讀取快取與延後繪製 ----------
    print("\n[perf] 讀取快取與延後繪製")
    seed(page)
    check("dates() 與 runIndex() 在同一次呼叫裡回傳同一份物件（有快到）",
          page.evaluate("""() => [dates() === dates(), runIndex() === runIndex()]"""),
          [True, True])
    # 快取的重點不是快，是不會給出過期的答案。
    # 這一項模擬「上一輪畫完之後才改 state，接著馬上讀」——沒有 persist、沒有 render，
    # 也就是最容易讓手寫失效機制漏掉的那條路徑。快取只活在同一個同步任務裡，
    # 所以新的任務一定拿到新的答案。
    page.evaluate("() => dates()")          # 前一個任務先把快取填起來
    check("上一輪的快取不會延續到下一次操作",
          page.evaluate("""() => {
              state.schedule['2027-01-01'] = [];
              return [dates().length, dates().includes('2027-01-01')];
          }"""),
          [3, True])
    # 界線寫成測試，而不是只寫在註解裡：同一個任務內「先讀、再改、又讀」
    # 讀到的仍是改之前的答案。這是刻意的取捨（一次繪製要呼叫上百次，
    # 每次都重算就失去意義），異動走 commit() → persist() 就不會遇到；
    # 哪天有人真的需要，改壞這一項會馬上被抓出來。
    check("同一個任務內先讀再改，要等 persist() 才看得到（已知界線）",
          page.evaluate("""() => {
              const before = dates().length;
              state.schedule['2027-02-02'] = [];
              const stale = dates().length;
              persist();
              return [stale === before, dates().includes('2027-02-02')];
          }"""),
          [True, True])
    check("新場次馬上就查得到，runIndex 不會停在舊索引",
          page.evaluate("""() => {
              state.schedule['2027-01-01'] = [{id:'newpt', name:'RUN X', capacity:5, slots:[], drops:[]}];
              return !!runIndex().get('newpt');
          }"""), True)
    check("刪掉的場次也會從索引消失",
          page.evaluate("""() => {
              delete state.schedule['2027-01-01'];
              persist();
              return [dates().includes('2027-01-01'), !!runIndex().get('newpt')];
          }"""), [False, False])

    seed(page)
    # 拍賣頁只需要 curSets，不該連材料頁的 DOM 一起重建；但切回材料頁時必須是新的。
    check("在拍賣頁重繪時不畫材料頁的 DOM，但數字照算",
          page.evaluate("""() => {
              document.querySelector('.tab[data-view="stats"]').click();
              document.getElementById('matDetail').innerHTML = '';
              document.querySelector('.tab[data-view="auction"]').click();
              render();
              return [document.getElementById('matDetail').innerHTML, typeof curSets];
          }"""), ["", "number"])
    check("切回材料頁會補畫，不會停在拍賣頁那一輪的空白",
          page.evaluate("""() => {
              document.querySelector('.tab[data-view="stats"]').click();
              return document.getElementById('matDetail').innerHTML.length > 0;
          }"""), True)
    check("直接呼叫 renderMaterials() 一定會畫（篩選變更靠的就是這個）",
          page.evaluate("""() => {
              document.getElementById('matBars').innerHTML = '';
              document.querySelector('.tab[data-view="board"]').click();
              renderMaterials();
              return document.getElementById('matBars').innerHTML.length > 0;
          }"""), True)

    # ---------- 日期欄位不准撐破容器 ----------
    print("\n[layout] 日期欄位寬度")
    # 回報情境：手機上拍賣頁的兩個期間篩選，欄位已經上下堆疊了，右邊還是超出畫面。
    # 原因是原生 date 欄位有自己的固有寬度，不吃 width:100%。
    # 這一項在多個寬度下量「欄位右緣有沒有超過內容區右緣」。
    def date_field_overflow(width):
        page.set_viewport_size({"width": width, "height": 900})
        page.wait_for_timeout(160)
        return page.evaluate("""() => {
            const app = document.querySelector('.app').getBoundingClientRect();
            const bad = [];
            document.querySelectorAll('input[type=date]').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width === 0) return;                     // 收起來的面板不算
                if (r.right - app.right > 0.5) bad.push(el.id);
            });
            return bad;
        }""")

    page.evaluate("""() => {
        document.querySelector('.tab[data-view="auction"]').click();
        document.getElementById('aucFiltBtn').click();
        aucFrom = '2026-05-01'; aucTo = '2026-08-31'; renderSales();
    }""")
    page.wait_for_timeout(200)
    for wpx in (320, 360, 390, 470):
        check(f"成交紀錄的日期欄位在 {wpx}px 不會超出內容區", date_field_overflow(wpx), [])
    page.evaluate("""() => {
        document.querySelector('[data-sub="asplit"]').click();
        document.getElementById('splFiltBtn').click();
        splFrom = '2026-05-01'; splTo = '2026-08-31'; renderSplit();
    }""")
    page.wait_for_timeout(200)
    for wpx in (320, 390):
        check(f"分潤試算的日期欄位在 {wpx}px 不會超出內容區", date_field_overflow(wpx), [])
    check("整頁沒有橫向捲動",
          page.evaluate("""() => document.documentElement.scrollWidth
                             <= document.documentElement.clientWidth"""), True)
    # 日期欄位必須明確被允許縮小，否則原生固有寬度會贏
    check("日期欄位設了 min-width:0 與 max-width:100%，不靠瀏覽器預設",
          page.evaluate("""() => {
              const s = getComputedStyle(document.getElementById('aucFrom'));
              return [s.minWidth, s.maxWidth === '100%' || s.maxWidth.endsWith('px')];
          }"""), ["0px", True])
    page.set_viewport_size({"width": 420, "height": 900})
    page.wait_for_timeout(150)
    seed(page)

    # ---------- 千分位格式沒有因為抽出共用格式器而改變 ----------
    check("nf 的輸出與抽出格式器前一致",
          page.evaluate("""() => [nf(0), nf(1234567), nf(1234.567), nf(-2500), nf('x'), nf(null)]"""),
          ["0", "1,234,567", "1,234.57", "-2,500", "0", "0"])

    # ---------- 未攔截的錯誤要看得見 ----------
    print("\n[err] 未攔截的錯誤")
    check("丟出未攔截的例外時會跳出提示，而不是靜靜卡住",
          page.evaluate("""async () => {
              document.querySelectorAll('.toast').forEach(t => t.remove());
              window.dispatchEvent(new ErrorEvent('error', {
                  error: new Error('測試用錯誤'), message: '測試用錯誤'}));
              await new Promise(r => setTimeout(r, 120));
              const t = document.querySelector('.toast');
              return t ? t.textContent.includes('資料仍在') : null;
          }"""), True)

    seed(page)


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

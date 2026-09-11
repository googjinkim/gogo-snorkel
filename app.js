  /* =========================================================
   * 데이터 로드: 원격 Apps Script API 대신 로컬 /data/scored.json
   * 하나만 fetch해서 4개 뷰(오늘/검색/지역/상세)를 전부 클라이언트에서 계산한다.
   * ========================================================= */
  var SCORED_DATA = null;

  function loadScoredData(onReady){
    if (SCORED_DATA) { onReady(); return; }
    fetch("./data/scored.json")
      .then(function(res){
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function(data){
        SCORED_DATA = data;
        onReady();
      })
      .catch(function(err){
        console.error(err);
        document.getElementById("main").innerHTML =
          emptyStateHtml("데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요. (" + err.message + ")");
      });
  }

  var INITIAL_LOCATION_ID = new URLSearchParams(window.location.search).get("id") || "";

  var state = { view: "home", regionId: "__ALL__" };

  /* ---------- 지역 상수 (7개, 사이드바 data-region 값 → area명) ---------- */
  var REGION_ORDER = ["gosung", "sokcho", "yangyang", "gangneung", "donghae", "samcheok", "uljin"];
  var REGION_NAMES = {
    gosung: "고성",
    sokcho: "속초",
    yangyang: "양양",
    gangneung: "강릉",
    donghae: "동해",
    samcheok: "삼척",
    uljin: "울진"
  };

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function setActiveSide(regionId){
    document.querySelectorAll(".side-item").forEach(function(el){
      el.classList.toggle("active", el.getAttribute("data-region") === regionId);
    });
  }

  function scoreClass(score){
    if (score === null || typeof score === "undefined") return "";
    if (score >= 80) return "good";
    if (score >= 65) return "mid";
    return "warn";
  }

  function isMobileView(){
    return window.matchMedia("(max-width:720px)").matches;
  }

  function bestBlockOf(blocks){
    var withScore = (blocks || []).filter(function(b){
      return b.score !== null && typeof b.score !== "undefined";
    });
    if (!withScore.length) return null;
    return withScore.slice().sort(function(a, b){ return b.score - a.score; })[0];
  }

  /* =========================================================
   * 아이콘 헬퍼 (원본 35_recommend_engine.gs scoreIconV2/weatherIconV2와 동일)
   * ========================================================= */
  function scoreIcon(score){
    if (score === null || typeof score === "undefined") return "⚪";
    if (score >= 90) return "🟢";
    if (score >= 80) return "🔵";
    if (score >= 65) return "🟡";
    if (score >= 50) return "🟠";
    return "🔴";
  }

  function weatherIcon(code){
    var n = Number(code);
    if (n === 0) return "☀️";
    if (n === 1 || n === 2) return "🌤";
    if (n === 3) return "☁️";
    if (n === 45 || n === 48) return "🌫";
    if ([51, 53, 55, 56, 57, 80, 81, 82].indexOf(n) !== -1) return "🌦";
    if ([61, 63, 65, 66, 67].indexOf(n) !== -1) return "🌧";
    if ([71, 73, 75, 77].indexOf(n) !== -1) return "❄️";
    if ([95, 96, 99].indexOf(n) !== -1) return "⛈";
    return "🌤";
  }

  /* =========================================================
   * 날짜/시간 유틸 (scored.json의 "yyyy-MM-dd HH:mm" 문자열을
   * 로컬 시각 기준 Date로 다룬다)
   * ========================================================= */
  var WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

  function parseTime(str){
    return new Date(String(str).replace(" ", "T"));
  }

  function pad2(n){
    return n < 10 ? "0" + n : String(n);
  }

  function formatDateLabel(date){
    return pad2(date.getMonth() + 1) + "/" + pad2(date.getDate()) + "(" + WEEKDAY_KO[date.getDay()] + ")";
  }

  function avg(values){
    if (!values.length) return null;
    var sum = values.reduce(function(a, b){ return a + b; }, 0);
    return sum / values.length;
  }

  function mostCommon(values){
    var counts = {};
    values.forEach(function(v){
      if (v === null || typeof v === "undefined") return;
      counts[v] = (counts[v] || 0) + 1;
    });
    var keys = Object.keys(counts).map(Number).sort(function(a, b){ return a - b; });
    if (!keys.length) return null;
    keys.sort(function(a, b){ return counts[b] - counts[a]; });
    return keys[0];
  }

  function getTodayRange(){
    var now = new Date();
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start, end: end };
  }

  // 이번 주: 월요일 00:00 ~ 다음 월요일 00:00 (로컬 시각 기준)
  function getThisWeekRange(){
    var now = new Date();
    var day = now.getDay();
    var diffToMonday = (day === 0) ? 6 : day - 1;
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - diffToMonday);
    var end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start, end: end };
  }

  function shortNameOf(point){
    var name = point.name || point.id || "";
    var prefix = point.area || "";
    if (prefix && name.indexOf(prefix + " ") === 0) {
      return name.slice(prefix.length + 1);
    }
    return name;
  }

  /* =========================================================
   * 4시간 블록 그룹핑 (원본 groupRowsByLocationDateTimeBlockV2 + blockToJsonV2_ 이식)
   * 입력: 특정 포인트의 hourly 배열 일부(날짜 범위 필터링된 것)
   * ========================================================= */
  function groupIntoBlocks(hourlyRows){
    var map = {};

    hourlyRows.forEach(function(h){
      var t = parseTime(h.time);
      var blockStartHour = Math.floor(t.getHours() / 4) * 4;
      var start = new Date(t);
      start.setHours(blockStartHour, 0, 0, 0);
      var end = new Date(start);
      end.setHours(start.getHours() + 4);

      var key = start.getTime();
      if (!map[key]) {
        map[key] = { start: start, end: end, scores: [], waves: [], temps: [], airTemps: [], weatherCodes: [] };
      }

      if (h.score !== null && typeof h.score !== "undefined") map[key].scores.push(h.score);
      if (h.forecastWave !== null && typeof h.forecastWave !== "undefined") map[key].waves.push(h.forecastWave);
      if (h.waterTemp !== null && typeof h.waterTemp !== "undefined") map[key].temps.push(h.waterTemp);
      if (h.airTemp !== null && typeof h.airTemp !== "undefined") map[key].airTemps.push(h.airTemp);
      if (h.weatherCode !== null && typeof h.weatherCode !== "undefined") map[key].weatherCodes.push(h.weatherCode);
    });

    return Object.keys(map)
      .map(function(key){ return map[key]; })
      .sort(function(a, b){ return a.start - b.start; })
      .map(function(g){
        var avgScore = avg(g.scores);
        var avgWave = avg(g.waves);
        var avgTemp = avg(g.temps);
        var avgAirTemp = avg(g.airTemps);
        var weatherCode = mostCommon(g.weatherCodes);

        return {
          startHour: pad2(g.start.getHours()),
          endHour: pad2(g.end.getHours()),
          dateLabel: formatDateLabel(g.start),
          startTimeIso: g.start.toISOString(),
          score: avgScore === null ? null : Math.round(avgScore),
          wave: avgWave === null ? null : Number(avgWave.toFixed(2)),
          temp: avgTemp === null ? null : Number(avgTemp.toFixed(1)),
          airTemp: avgAirTemp === null ? null : Number(avgAirTemp.toFixed(1)),
          weatherCode: weatherCode,
          scoreIcon: scoreIcon(avgScore),
          weatherIcon: weatherIcon(weatherCode)
        };
      });
  }

  function filterHourlyByRange(hourly, range){
    return hourly.filter(function(h){
      var t = parseTime(h.time);
      return t >= range.start && t < range.end;
    });
  }

  function groupBlocksByDate(blocks){
    var byDate = {};
    var order = [];
    blocks.forEach(function(b){
      if (!byDate[b.dateLabel]) {
        byDate[b.dateLabel] = [];
        order.push(b.dateLabel);
      }
      byDate[b.dateLabel].push(b);
    });
    return order.map(function(dateLabel){
      return { dateLabel: dateLabel, blocks: byDate[dateLabel] };
    });
  }

  /* =========================================================
   * 4개 뷰: action=today/search/region/detail 대체
   * ========================================================= */
  function buildTodayView(){
    var range = getTodayRange();
    var now = new Date();

    var locations = SCORED_DATA.points.map(function(point){
      var todayHourly = filterHourlyByRange(point.hourly, range);
      return {
        id: point.id,
        name: point.name,
        shortName: shortNameOf(point),
        area: point.area,
        blocks: groupIntoBlocks(todayHourly)
      };
    });

    return {
      todayLabel: formatDateLabel(now),
      locations: locations
    };
  }

  function buildWeekDataForLocation(pointId){
    var point = SCORED_DATA.points.find(function(p){ return p.id === pointId; });
    if (!point) return null;

    var range = getThisWeekRange();
    var weekHourly = filterHourlyByRange(point.hourly, range);
    var blocks = groupIntoBlocks(weekHourly);

    return {
      id: point.id,
      name: point.name,
      shortName: shortNameOf(point),
      area: point.area,
      hasKhoaMapping: Boolean(point.hasKhoaMapping),
      days: groupBlocksByDate(blocks)
    };
  }

  // 검색어/이름을 비교할 때 공백 차이를 무시하기 위한 정규화
  function normalizeForSearch(value){
    return String(value || "").toLowerCase().replace(/\s+/g, "");
  }

  function buildSearchResults(query){
    var q = normalizeForSearch(query);
    if (!q) return { query: "", results: [], beaches: [] };

    var matched = SCORED_DATA.points.filter(function(point){
      return normalizeForSearch(point.name).indexOf(q) !== -1 ||
        normalizeForSearch(point.area).indexOf(q) !== -1 ||
        normalizeForSearch(point.id).indexOf(q) !== -1;
    });

    var beachData = SCORED_DATA.beachRestrooms || {};
    var matchedBeaches = [];
    Object.keys(beachData).forEach(function(areaName){
      (beachData[areaName] || []).forEach(function(beach){
        if (normalizeForSearch(beach.beachName).indexOf(q) !== -1 ||
            normalizeForSearch(beach.area).indexOf(q) !== -1) {
          matchedBeaches.push(beach);
        }
      });
    });

    return {
      query: String(query || "").trim(),
      results: matched.map(function(point){ return buildWeekDataForLocation(point.id); }),
      beaches: matchedBeaches
    };
  }

  function buildRegionResults(regionId){
    var matched = SCORED_DATA.points.filter(function(point){ return point.area === regionId; });

    return {
      regionId: regionId,
      regionName: regionId,
      results: matched.map(function(point){ return buildWeekDataForLocation(point.id); })
    };
  }

  // 해당 포인트의 hourly 전체(scored.json에 있는 8일치 그대로)를 날짜별로 묶은 뒤,
  // 각 날짜가 이번주/다음주 캘린더 주 중 어디에 속하는지로 분류한다.
  function buildHourlyDetail(pointId){
    var point = SCORED_DATA.points.find(function(p){ return p.id === pointId; });
    if (!point) return null;

    var hourly = point.hourly.slice().sort(function(a, b){
      return parseTime(a.time) - parseTime(b.time);
    });

    var byDate = {};
    var order = [];
    hourly.forEach(function(h){
      var t = parseTime(h.time);
      var dateLabel = formatDateLabel(t);
      if (!byDate[dateLabel]) {
        byDate[dateLabel] = { date: new Date(t.getFullYear(), t.getMonth(), t.getDate()), hours: [] };
        order.push(dateLabel);
      }
      byDate[dateLabel].hours.push({
        time: h.time.slice(11, 16),
        dateLabel: dateLabel,
        score: h.score === null || typeof h.score === "undefined" ? null : h.score,
        grade: h.grade || "",
        recommendation: h.recommendation || "",
        reason: h.reason || "",
        wave: h.forecastWave === null || typeof h.forecastWave === "undefined" ? null : h.forecastWave,
        swell: h.swellWave === null || typeof h.swellWave === "undefined" ? null : h.swellWave,
        temp: h.waterTemp === null || typeof h.waterTemp === "undefined" ? null : h.waterTemp,
        airTemp: h.airTemp === null || typeof h.airTemp === "undefined" ? null : h.airTemp,
        observedStation: "",
        observedWave: h.observedWave === null || typeof h.observedWave === "undefined" ? null : h.observedWave,
        observedMaxWave: h.maxObservedWave === null || typeof h.maxObservedWave === "undefined" ? null : h.maxObservedWave,
        diff: null,
        weatherCode: h.weatherCode,
        weatherIcon: weatherIcon(h.weatherCode),
        scoreIcon: scoreIcon(h.score),
        dataStatus: point.hasKhoaMapping ? "예보+실측" : "예보만"
      });
    });

    var currentRange = getThisWeekRange();
    var nextStart = new Date(currentRange.end);
    var nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 7);
    var nextRange = { start: nextStart, end: nextEnd };

    var currentDays = [];
    var nextDays = [];
    order.forEach(function(dateLabel){
      var group = byDate[dateLabel];
      if (group.date >= currentRange.start && group.date < currentRange.end) {
        currentDays.push({ dateLabel: dateLabel, hours: group.hours });
      } else if (group.date >= nextRange.start && group.date < nextRange.end) {
        nextDays.push({ dateLabel: dateLabel, hours: group.hours });
      }
      // 두 범위 밖 날짜는(있을 수 없지만 방어적으로) 무시한다.
    });

    var weeks = [{ weekKey: "current", weekLabel: "이번주", days: currentDays }];
    if (nextDays.length) {
      weeks.push({ weekKey: "next", weekLabel: "다음주", days: nextDays });
    }

    return {
      id: point.id,
      name: point.name,
      shortName: shortNameOf(point),
      area: point.area,
      hasKhoaMapping: Boolean(point.hasKhoaMapping),
      restrooms: point.restrooms || [],
      weeks: weeks
    };
  }

  /* ---------- 모바일 사이드바 (햄버거) ---------- */
  var asideEl = document.querySelector("aside");
  var menuToggleBtn = document.getElementById("menuToggle");
  var sidebarOverlayEl = document.getElementById("sidebarOverlay");
  var sidebarCloseBtn = document.getElementById("sidebarClose");

  function openSidebar(){
    asideEl.classList.add("open");
    sidebarOverlayEl.classList.add("show");
  }
  function closeSidebar(){
    asideEl.classList.remove("open");
    sidebarOverlayEl.classList.remove("show");
  }
  menuToggleBtn.addEventListener("click", openSidebar);
  sidebarOverlayEl.addEventListener("click", closeSidebar);
  sidebarCloseBtn.addEventListener("click", closeSidebar);

  /* ---------- init: sidebar ---------- */
  function initSidebar(){
    document.querySelectorAll(".side-item").forEach(function(el){
      el.addEventListener("click", function(){
        var regionId = el.getAttribute("data-region");
        document.getElementById("searchInput").value = "";
        setActiveSide(regionId);
        closeSidebar();
        if (regionId === "__ALL__") {
          renderHome();
        } else if (regionId === "__BEACH_RESTROOMS__") {
          renderBeachRestrooms();
        } else {
          loadRegion(regionId);
        }
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
    });

    var groupHeader = document.getElementById("eastSeaToggle");
    var regionGroup = document.getElementById("regionList");
    var regionCount = regionGroup.querySelectorAll(".side-item").length;
    document.getElementById("regionCountChip").textContent = "지역 " + regionCount;

    groupHeader.addEventListener("click", function(){
      var collapsed = regionGroup.classList.toggle("collapsed");
      groupHeader.classList.toggle("collapsed", collapsed);
      groupHeader.setAttribute("aria-expanded", String(!collapsed));
    });
  }

  /* ---------- 사이드바 사진: 로드 완료 후 부드럽게 페이드인 ---------- */
  (function(){
    var photo = document.querySelector(".side-photo img");
    if (!photo) return;
    if (photo.complete) {
      photo.classList.add("loaded");
    } else {
      photo.addEventListener("load", function(){ photo.classList.add("loaded"); });
    }
  })();

  document.getElementById("brandBtn").addEventListener("click", function(){
    document.getElementById("searchInput").value = "";
    setActiveSide("__ALL__");
    renderHome();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });

  document.getElementById("searchForm").addEventListener("submit", function(e){
    e.preventDefault();
    var q = document.getElementById("searchInput").value.trim();
    if (!q) return;
    setActiveSide("__NONE__");
    loadSearch(q);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });

  /* ---------- home (오늘) ---------- */
  var lastHomeData = null;

  function renderHome(){
    state.view = "home";
    document.getElementById("main").innerHTML = '<div class="loading">오늘 데이터를 불러오는 중…</div>';
    loadScoredData(function(){
      lastHomeData = buildTodayView();
      drawHome();
    });
  }

  function drawHome(){
    var data = lastHomeData;
    if (!data) return;
    state.view = "home";

    var html = '<div class="list-sticky">' +
      '<div class="page-title"><h1>오늘의 동해안 바다 상황</h1>' +
      '<span class="count">' + esc(data.todayLabel) + ' · ' + data.locations.length + '개 포인트</span></div>' +
      legendHtml(true) +
      '</div>';

    if (!data.locations.length) {
      document.getElementById("main").innerHTML = html + emptyStateHtml("표시할 데이터가 없습니다.");
      return;
    }

    if (isMobileView()) {
      html += data.locations.map(function(loc){
        return summaryRowHtml(loc, bestBlockOf(loc.blocks));
      }).join("");
      document.getElementById("main").innerHTML = html;
      bindSummaryRows("home");
    } else {
      html += data.locations.map(function(loc){ return locationRowHtml(loc, false); }).join("");
      document.getElementById("main").innerHTML = html;
      bindDetailButtons(drawHome);
    }
  }

  /* ---------- search / region (이번주) ---------- */
  var lastResultsData = null;

  function renderResultsPage(title, sub, results, beaches){
    lastResultsData = { title: title, sub: sub, results: results, beaches: beaches || [] };
    state.view = "results";
    drawResults();
  }

  function drawResults(){
    var data = lastResultsData;
    if (!data) return;
    state.view = "results";
    pendingBeachRestroomMaps = [];

    var beaches = data.beaches || [];

    var html = '<div class="list-sticky">' +
      '<div class="page-title"><h1>' + esc(data.title) + '</h1>' +
      '<span class="count">' + data.results.length + '개 포인트' +
      (beaches.length ? ' · 화장실 ' + beaches.length + '곳' : '') + '</span></div>' +
      (data.sub ? '<p class="page-sub">' + esc(data.sub) + '</p>' : "") +
      legendHtml() +
      '</div>';

    if (!data.results.length && !beaches.length) {
      html += emptyStateHtml("일치하는 바다 포인트가 없습니다. 지역명이나 포인트 이름으로 다시 검색해보세요.");
      document.getElementById("main").innerHTML = html;
      return;
    }

    if (data.results.length) {
      if (isMobileView()) {
        html += data.results.map(function(loc){
          var todayBlocks = (loc.days && loc.days.length) ? loc.days[0].blocks : [];
          return summaryRowHtml(loc, bestBlockOf(todayBlocks));
        }).join("");
      } else {
        html += data.results.map(function(loc){ return locationRowHtml(loc, true); }).join("");
      }
    }

    if (beaches.length) {
      html += '<div class="search-restroom-section">' +
        '<h2 class="search-restroom-title">🚻 화장실 정보</h2>' +
        beaches.map(beachBlockHtml).join("") +
        '</div>';
    }

    document.getElementById("main").innerHTML = html;

    if (data.results.length) {
      if (isMobileView()) { bindSummaryRows("results"); } else { bindDetailButtons(drawResults); }
    }
    if (beaches.length) { bindBeachRestroomMaps(); }
  }

  function loadSearch(query){
    document.getElementById("main").innerHTML = '<div class="loading">검색 중…</div>';
    loadScoredData(function(){
      var data = buildSearchResults(query);
      renderResultsPage('"' + query + '" 검색 결과', "이번 주 데이터 (오늘 포함, 4시간 단위)", data.results, data.beaches);
    });
  }

  function loadRegion(regionId){
    document.getElementById("main").innerHTML = '<div class="loading">불러오는 중…</div>';
    loadScoredData(function(){
      var regionName = REGION_NAMES[regionId] || regionId;
      var data = buildRegionResults(regionName);
      renderResultsPage(regionName, "이번 주 데이터 (오늘 포함, 4시간 단위)", data.results);
    });
  }

  /* ---------- 동해바다 화장실 정보 (지도 없이 이름/주소/운영시간만) ----------
   * lib/beachRestrooms.js(사람 확인 완료된 결과)가 scored.json 생성 시
   * build-score.js를 통해 최상위 beachRestrooms 필드로 이미 포함되어 있다. */
  function renderBeachRestrooms(){
    state.view = "beachRestrooms";
    document.getElementById("main").innerHTML = '<div class="loading">화장실 정보를 불러오는 중…</div>';
    loadScoredData(function(){
      drawBeachRestrooms();
    });
  }

  /* beachRestroomCardHtml은 여러 해변 블록에 걸쳐 반복 호출되므로(동해바다
   * 화장실 정보 전용 페이지, 검색 결과의 화장실 섹션 둘 다), 좌표가 있는
   * 항목마다 페이지 전체 기준으로 겹치지 않는 id를 붙여야 한다. pendingBeach
   * RestroomMaps가 렌더링 순서 그대로 대상 restroom을 쌓아두고, innerHTML
   * 반영 후 bindBeachRestroomMaps()가 같은 순서로 클릭 핸들러를 붙인다. */
  var pendingBeachRestroomMaps = [];

  function beachRestroomCardHtml(restroom){
    var addr = restroom.roadAddr || restroom.lotAddr || "";
    var hoursHtml = restroom.openHours
      ? '<span class="restroom-hours">🕐 ' + esc(restroom.openHours) + '</span>'
      : "";
    var hasCoords = restroom.lat !== null && typeof restroom.lat !== "undefined" &&
      restroom.lon !== null && typeof restroom.lon !== "undefined";
    var mapHtml = "";
    if (hasCoords) {
      var uid = pendingBeachRestroomMaps.length;
      pendingBeachRestroomMaps.push(restroom);
      mapHtml = '<button class="restroom-map-btn" id="beachRestroomMapBtn' + uid + '" type="button">지도 보기</button>' +
        '<div class="restroom-map" id="beachRestroomMap' + uid + '" hidden></div>';
    }
    return '<div class="restroom-card">' +
      '<div class="restroom-info">' +
      '<span class="restroom-icon" aria-hidden="true">🚻</span>' +
      '<div class="restroom-text">' +
      '<span class="restroom-name">' + esc(restroom.name || "인근 화장실") + '</span>' +
      '<span class="restroom-addr">' + esc(addr) + '</span>' +
      hoursHtml +
      '</div></div>' +
      mapHtml +
      '</div>';
  }

  /* innerHTML 대입 직후 호출: beachRestroomCardHtml이 쌓아둔 순서 그대로
   * 각 카드의 지도 토글을 bindRestroomMapToggle로 연결하고 목록을 비운다. */
  function bindBeachRestroomMaps(){
    pendingBeachRestroomMaps.forEach(function(restroom, uid){
      bindRestroomMapToggle("beachRestroomMapBtn" + uid, "beachRestroomMap" + uid, restroom);
    });
    pendingBeachRestroomMaps = [];
  }

  function beachBlockHtml(beach){
    return '<div class="beach-block">' +
      '<h3 class="beach-name">' + esc(beach.beachName) + '</h3>' +
      '<div class="restroom-cards">' +
      (beach.restrooms || []).map(beachRestroomCardHtml).join("") +
      '</div></div>';
  }

  function drawBeachRestrooms(){
    state.view = "beachRestrooms";
    pendingBeachRestroomMaps = [];
    var data = SCORED_DATA.beachRestrooms || {};
    var totalBeaches = REGION_ORDER.reduce(function(sum, regionId){
      return sum + ((data[REGION_NAMES[regionId]] || []).length);
    }, 0);

    var html = '<div class="detail-sticky">' +
      '<button class="back-link" id="beachBackBtn">← 목록으로</button>' +
      '<div class="page-title"><h1>동해안 화장실 정보</h1>' +
      '<span class="count">총 ' + totalBeaches + '개 해변</span></div>' +
      '</div>';

    REGION_ORDER.forEach(function(regionId){
      var areaName = REGION_NAMES[regionId];
      var beaches = data[areaName] || [];
      if (!beaches.length) return;
      html += '<div class="beach-region-section">' +
        '<h2 class="beach-region-title">' + esc(areaName) + '</h2>' +
        beaches.map(beachBlockHtml).join("") +
        '</div>';
    });

    document.getElementById("main").innerHTML = html;
    document.getElementById("beachBackBtn").addEventListener("click", function(){
      setActiveSide("__ALL__");
      renderHome();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    bindBeachRestroomMaps();
  }

  /* ---------- 모바일 요약 → 확장(오늘/이번주 블록) ---------- */
  function bindSummaryRows(kind){
    document.querySelectorAll(".summary-row").forEach(function(row){
      row.addEventListener("click", function(){
        var id = row.getAttribute("data-id");
        var loc;
        if (kind === "home") {
          loc = (lastHomeData.locations || []).find(function(l){ return l.id === id; });
        } else {
          loc = (lastResultsData.results || []).find(function(l){ return l.id === id; });
        }
        if (loc) {
          renderLocationExpanded(loc, kind);
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }
      });
    });
  }

  function renderLocationExpanded(loc, kind){
    state.view = "expanded";
    var backLabel = kind === "home" ? "오늘 목록으로" : "목록으로";
    var html = '<button class="back-link" id="backBtn">← ' + backLabel + '</button>' +
      locationRowHtml(loc, kind === "results");
    document.getElementById("main").innerHTML = html;
    bindDetailButtons(function(){ renderLocationExpanded(loc, kind); });
    document.getElementById("backBtn").addEventListener("click", function(){
      if (kind === "home") { drawHome(); } else { drawResults(); }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
  }

  /* ---------- 자세히 보기 (1시간 단위) ---------- */
  function loadDetail(locationId, returnFn){
    state.view = "detail";
    document.getElementById("main").innerHTML = '<div class="loading">상세 데이터를 불러오는 중…</div>';
    loadScoredData(function(){
      var data = buildHourlyDetail(locationId);
      if (!data) {
        document.getElementById("main").innerHTML = emptyStateHtml("해당 포인트를 찾을 수 없습니다.");
        return;
      }
      renderDetailView(data, 0, returnFn);
    });
  }

  // 점수가 높은 순 -> 동점이면 forecastWave 낮은(잔잔한) 순(null은 최하위) ->
  // 그래도 동점이면 이른 시간 순으로 상위 n개 { time, score } 항목을 뽑는다.
  function topScoreTimes(hours, n){
    return hours
      .map(function(h, idx){ return { time: h.time, score: h.score, wave: h.wave, idx: idx }; })
      .filter(function(h){ return h.score !== null && typeof h.score !== "undefined"; })
      .sort(function(a, b){
        if (b.score !== a.score) return b.score - a.score;
        var aWave = (a.wave === null || typeof a.wave === "undefined") ? Infinity : a.wave;
        var bWave = (b.wave === null || typeof b.wave === "undefined") ? Infinity : b.wave;
        if (aWave !== bWave) return aWave - bWave;
        return a.idx - b.idx;
      })
      .slice(0, n);
  }

  // scoreIcon()과 동일한 구간으로 배지 색상 클래스를 정한다.
  function scoreTierClass(score){
    if (score === null || typeof score === "undefined") return "tier-low";
    if (score >= 90) return "tier-90";
    if (score >= 80) return "tier-80";
    if (score >= 65) return "tier-65";
    if (score >= 50) return "tier-50";
    return "tier-low";
  }

  /* ---------- 화장실 정보 카드 + 카카오맵 임베드 ----------
   * lib/restrooms.js(사람 확인 전 자동 매칭 결과)가 scored.json 생성 시
   * build-score.js를 통해 각 포인트의 restroom 필드로 이미 포함되어 있다.
   * 지도는 카카오맵 JS SDK를 최초 클릭 시점에 1회만 로드해서 재사용한다.
   * JavaScript 키는 도메인 제한이 걸려 있어 클라이언트 코드에 그대로 두어도 된다. */
  var KAKAO_JS_KEY = "c93b786c0ea166db993fd5f4fc7ff7be";
  var kakaoMapsReadyPromise = null;

  function loadKakaoMaps(){
    if (window.kakao && window.kakao.maps && window.kakao.maps.LatLng) {
      return Promise.resolve();
    }
    if (!kakaoMapsReadyPromise) {
      kakaoMapsReadyPromise = new Promise(function(resolve, reject){
        var script = document.createElement("script");
        script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" + KAKAO_JS_KEY + "&autoload=false";
        script.onload = function(){
          window.kakao.maps.load(function(){ resolve(); });
        };
        script.onerror = function(){ reject(new Error("카카오맵 SDK 로드 실패")); };
        document.head.appendChild(script);
      });
    }
    return kakaoMapsReadyPromise;
  }

  function restroomSingleCardHtml(restroom, idx){
    var addr = restroom.roadAddr || restroom.lotAddr || "";
    var distText = (restroom.distanceKm === null || typeof restroom.distanceKm === "undefined")
      ? "" : restroom.distanceKm.toFixed(2) + "km";
    var hoursHtml = restroom.openHours
      ? '<span class="restroom-hours">🕐 ' + esc(restroom.openHours) + '</span>'
      : "";
    return '<div class="restroom-card">' +
      '<div class="restroom-info">' +
      '<span class="restroom-icon" aria-hidden="true">🚻</span>' +
      '<div class="restroom-text">' +
      '<span class="restroom-name">' + esc(restroom.name || "인근 화장실") + '</span>' +
      '<span class="restroom-addr">' + esc(addr) + (distText ? ' · ' + distText : '') + '</span>' +
      hoursHtml +
      '</div></div>' +
      '<button class="restroom-map-btn" id="restroomMapBtn' + idx + '" type="button">지도 보기</button>' +
      '<div class="restroom-map" id="restroomMap' + idx + '" hidden></div>' +
      '</div>';
  }

  function restroomCardHtml(restrooms){
    if (!restrooms || !restrooms.length) return "";
    return '<div class="restroom-cards">' +
      restrooms.map(restroomSingleCardHtml).join("") +
      '</div>';
  }

  /* 화장실 카드 하나의 "지도 보기" 버튼/컨테이너를 토글에 연결한다. 20개
   * 포인트 카드(restroomCardHtml)와 동해바다 화장실 전체 목록/검색 결과의
   * 화장실 카드(beachRestroomCardHtml)가 이 함수 하나를 공유한다 — 카드
   * 종류별로 id만 다르게 붙이고 동작은 완전히 동일하다. */
  function bindRestroomMapToggle(btnId, mapId, restroom){
    var btn = document.getElementById(btnId);
    if (!btn) return;
    var mapEl = document.getElementById(mapId);
    var mapInstance = null;

    btn.addEventListener("click", function(){
      if (!mapEl.hidden) {
        mapEl.hidden = true;
        btn.textContent = "지도 보기";
        return;
      }
      if (restroom.lat === null || typeof restroom.lat === "undefined" ||
          restroom.lon === null || typeof restroom.lon === "undefined") {
        console.error("[restroom] 좌표 정보가 없어 지도를 표시할 수 없습니다.");
        return;
      }
      mapEl.hidden = false;
      btn.textContent = "지도 접기";
      loadKakaoMaps().then(function(){
        var center = new kakao.maps.LatLng(restroom.lat, restroom.lon);
        if (!mapInstance) {
          mapInstance = new kakao.maps.Map(mapEl, { center: center, level: 4 });
          new kakao.maps.Marker({ position: center, map: mapInstance });
        } else {
          kakao.maps.event.trigger(mapInstance, "resize");
          mapInstance.setCenter(center);
        }
      }).catch(function(err){
        console.error("[restroom] 지도 로드 실패:", err.message);
      });
    });
  }

  /* 카드마다 독립된 지도 인스턴스/토글 상태를 갖도록 idx로 구분해서 바인딩한다. */
  function bindRestroomCard(restrooms){
    (restrooms || []).forEach(function(restroom, idx){
      bindRestroomMapToggle("restroomMapBtn" + idx, "restroomMap" + idx, restroom);
    });
  }

  function renderDetailView(data, activeWeekIndex, returnFn){
    var html = '<div class="detail-sticky">' +
      '<button class="back-link" id="backBtn">← 목록으로</button>' +
      '<div class="page-title"><h1>' + esc(data.name) + '</h1>' +
      '<span class="count">1시간 단위</span></div>';

    if (!data.hasKhoaMapping) {
      html += '<p class="page-sub">이 포인트는 인근 KHOA 실측 관측소가 없어 예보(Open-Meteo) 데이터만 제공됩니다.</p>';
    }

    if (data.weeks.length > 1) {
      html += '<div class="week-tabs">' +
        data.weeks.map(function(w, i){
          return '<button class="week-tab' + (i === activeWeekIndex ? ' active' : '') +
            '" data-week-index="' + i + '">' + esc(w.weekLabel) + '</button>';
        }).join("") +
        '</div>';
    }

    html += '</div>';

    html += restroomCardHtml(data.restrooms);

    var activeWeek = data.weeks[activeWeekIndex] || data.weeks[0];
    var mobile = isMobileView();

    activeWeek.days.forEach(function(day){
      var bestEntries = topScoreTimes(day.hours, 3);
      var bestHtml = bestEntries.length
        ? '<span class="day-best-label">베스트</span>' +
          '<span class="day-best">' + bestEntries.map(function(entry, i){
            var crownClass = i === 0 ? 'crown-icon' : 'crown-icon hidden';
            return '<span class="time-badge-wrap">' +
              '<i class="ti ti-crown ' + crownClass + '" aria-hidden="true"></i>' +
              '<span class="time-badge ' + scoreTierClass(entry.score) + '">' + esc(entry.time) + '</span>' +
              '</span>';
          }).join('') + '</span>'
        : '';

      html += '<div class="hour-day"><h2>' + esc(day.dateLabel) + bestHtml + '</h2>' +
        '<table class="hours"><thead><tr>' +
        '<th>시간</th><th>점수</th><th>파고</th><th>너울</th><th>수온</th><th>날씨</th>' +
        (mobile ? '' : '<th>코멘트</th>') +
        '</tr></thead><tbody>' +
        day.hours.map(function(h){
          return '<tr>' +
            '<td class="mono">' + esc(h.time) + '</td>' +
            '<td>' + esc(h.scoreIcon) + ' <span class="mono score ' + scoreClass(h.score) + '">' + esc(h.score === null ? "-" : h.score) + '</span></td>' +
            '<td class="mono">' + esc(h.wave === null ? "-" : h.wave + "m") + '</td>' +
            '<td class="mono">' + esc(h.swell === null ? "-" : h.swell + "m") + '</td>' +
            '<td class="mono">' + esc(h.temp === null ? "-" : h.temp + "℃") + '</td>' +
            '<td class="weather-cell mono">' + esc(h.weatherIcon) +
              (h.airTemp === null ? "" : esc(Math.round(h.airTemp) + "°C")) + '</td>' +
            (mobile ? '' : '<td class="reason-cell">' + esc(h.reason) + '</td>') +
            '</tr>';
        }).join("") +
        '</tbody></table></div>';
    });

    document.getElementById("main").innerHTML = html;

    document.getElementById("backBtn").addEventListener("click", function(){
      if (returnFn) { returnFn(); } else { renderHome(); }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });

    document.querySelectorAll(".week-tab").forEach(function(btn){
      btn.addEventListener("click", function(){
        renderDetailView(data, Number(btn.getAttribute("data-week-index")), returnFn);
      });
    });

    bindRestroomCard(data.restrooms);
  }

  function bindDetailButtons(returnFn){
    document.querySelectorAll("[data-detail-id]").forEach(function(btn){
      btn.addEventListener("click", function(){
        loadDetail(btn.getAttribute("data-detail-id"), returnFn);
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
    });
  }

  /* ---------- 헤더 실제 높이 측정 → --header-height CSS 변수 반영 ----------
   * sticky 요소(aside, .list-sticky, .detail-sticky)가 하드코딩된 px 값
   * 대신 이 변수를 참조하므로, 헤더 높이가 폰트 로딩/리사이즈로 바뀌어도
   * 항상 실제 렌더링 높이와 어긋나지 않는다. */
  function updateHeaderHeightVar(){
    var header = document.querySelector("header");
    if (!header) return;
    var height = header.getBoundingClientRect().height;
    if (height > 0) {
      document.documentElement.style.setProperty("--header-height", height + "px");
    }
  }
  updateHeaderHeightVar();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateHeaderHeightVar);
  }

  /* ---------- 화면 크기 전환 시 홈/목록 화면 다시 그리기 ---------- */
  var resizeTimer = null;
  window.addEventListener("resize", function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      updateHeaderHeightVar();
      if (state.view === "home") drawHome();
      if (state.view === "results") drawResults();
    }, 200);
  });

  /* ---------- html builders ---------- */
  function legendHtml(withRestroomBadge){
    return '<div class="legend">' +
      '<span>🟢 최고(90+)</span><span>🔵 좋음(80+)</span><span>🟡 보통(65+)</span>' +
      '<span>🟠 주의(50+)</span><span>🔴 비추천</span>' +
      (withRestroomBadge ? '<span class="legend-restroom-badge">🚻 화장실 정보는 [이번주 자세히] 보기에서</span>' : '') +
      '</div>';
  }

  function emptyStateHtml(msg){
    return '<div class="empty-state">' + esc(msg) + '</div>';
  }

  function summaryRowHtml(loc, best){
    var scoreCls = best ? scoreClass(best.score) : "";
    var scoreText = best ? esc(best.scoreIcon + ' ' + best.score) : "-";
    var weather = best ? esc(best.weatherIcon) : "";
    var waveText = (best && best.wave !== null && typeof best.wave !== "undefined")
      ? esc('↗' + best.wave + 'm') : "";
    var bestSlotChipHtml = best
      ? ('<div class="summary-slot"><span class="label">오늘 최고</span>' +
         '<span class="time">' + esc(best.startHour + '~' + best.endHour + '시') + '</span></div>')
      : "";

    return '<div class="summary-row" data-id="' + esc(loc.id) + '">' +
      '<div class="summary-info">' +
      '<span class="location-name">' + esc(loc.name) + '</span>' +
      '<span class="location-area">' + esc(loc.area) +
      (loc.hasKhoaMapping === false ? ' · 예보 전용' : '') + '</span>' +
      '</div>' +
      bestSlotChipHtml +
      '<div class="summary-score">' +
      '<span class="score ' + scoreCls + '">' + scoreText + '</span>' +
      (waveText ? '<span class="summary-wave mono">' + waveText + '</span>' : '') +
      '<span>' + weather + '</span>' +
      '<span class="chev">›</span>' +
      '</div></div>';
  }

  function slotHtml(b){
    var timeText = (b.dateLabel ? b.dateLabel + " " : "") + b.startHour + '~' + b.endHour + '시';
    var timeHtml = '<div class="t">' + esc(timeText) + '</div>';

    var airTempText = (b.airTemp === null || typeof b.airTemp === "undefined") ? "" : esc(b.airTemp + "°C");

    if (isMobileView()) {
      return '<div class="slot slot-full">' +
        '<div class="row1">' +
        '<span class="t-inline">' + esc(timeText) + '</span>' +
        '<span class="score mono ' + scoreClass(b.score) + '">' + esc(b.scoreIcon) + ' ' + esc(b.score === null ? "-" : b.score) + '</span>' +
        '<span class="mono">↗' + esc(b.wave === null ? "-" : b.wave) + 'm</span>' +
        '<span class="mono">💧' + esc(b.temp === null ? "-" : b.temp) + '℃</span>' +
        '<span class="weather-inline"><span class="weather-icon-box">' + esc(b.weatherIcon) + '</span>' +
          '<span class="weather-temp-box mono">' + airTempText + '</span></span>' +
        '</div>' +
        '</div>';
    }

    return '<div class="slot slot-compact">' +
      timeHtml +
      '<div class="row1 mono">' +
      '<span class="score ' + scoreClass(b.score) + '">' + esc(b.scoreIcon) + ' ' + esc(b.score === null ? "-" : b.score) + '</span>' +
      '<span>↗' + esc(b.wave === null ? "-" : b.wave) + 'm</span>' +
      '<span>💧' + esc(b.temp === null ? "-" : b.temp) + '℃</span>' +
      '<span class="weather-inline"><span class="weather-icon-box">' + esc(b.weatherIcon) + '</span>' +
        '<span class="weather-temp-box">' + airTempText + '</span></span>' +
      '</div>' +
      '</div>';
  }

  function locationRowHtml(loc, showDays){
    var head = '<div class="location-head">' +
      '<div><span class="location-name">' + esc(loc.name) + '</span>' +
      '<span class="location-area">' + esc(loc.area) + '</span>' +
      (loc.hasKhoaMapping === false ? ' <span class="no-khoa-tag">· 예보 전용</span>' : "") +
      '</div>' +
      '<button class="detail-btn" data-detail-id="' + esc(loc.id) + '">이번주 자세히<i class="ti ti-chevron-right" aria-hidden="true"></i></button>' +
      '</div>';

    var body;
    if (showDays) {
      if (!loc.days || !loc.days.length) {
        body = '<div class="day-block"><div class="day-label">데이터 없음</div></div>';
      } else {
        body = loc.days.map(function(day){
          return '<div class="day-block">' +
            '<div class="day-label">' + esc(day.dateLabel) + '</div>' +
            '<div class="slots">' + day.blocks.map(slotHtml).join("") + '</div>' +
            '</div>';
        }).join("");
      }
    } else {
      var blocks = loc.blocks || [];
      body = '<div class="day-block"><div class="slots">' +
        (blocks.length ? blocks.map(slotHtml).join("") : '<div class="slot empty">오늘 데이터 없음</div>') +
        '</div></div>';
    }

    return '<div class="location">' + head + body + '</div>';
  }

  /* ---------- boot ---------- */
  if (isMobileView()) {
    document.getElementById("searchInput").setAttribute("placeholder", "포인트/지역 검색");
  }
  initSidebar();
  if (INITIAL_LOCATION_ID) {
    loadDetail(INITIAL_LOCATION_ID);
  } else {
    renderHome();
  }

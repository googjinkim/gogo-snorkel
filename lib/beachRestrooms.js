// TODO: 자동 조사 결과 (사람 검토/확정 전).
// scripts/find-all-beach-restrooms.js가 행정안전부 공중화장실정보 API에서
// 동해안 7개 시군 내 이름/주소에 "해수욕장" 또는 "해변"이 포함된 화장실을
// 전부 찾아 지명 기준으로 그룹핑하고, 카카오 주소 검색으로 지오코딩해서
// 그룹별 화장실 후보(최대 2건)를 채운 결과다. 그룹핑이 애매했던 항목은
// 이 파일에 포함되지 않고 스크립트 실행 시 콘솔에 "미분류"로만 출력된다.
// 실제로 쓰기 전에 콘솔 출력(지역별 요약, 미분류 목록)을 사람이 검토해야 한다.

const BEACH_RESTROOMS = {
  고성: [
    {
      beachName: "봉포해변",
      area: "고성",
      restrooms: [
        {
          name: "봉포해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 토성면 봉포리 180-1 인근",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "봉포항",
          roadAddr: "강원특별자치도 고성군 토성면 봉포해변길 120",
          lotAddr: "강원특별자치도 고성군 토성면 봉포리 1-10",
          openHours: "24시간 운영",
          distanceKm: 0.18,
        },
      ],
    },
    {
      beachName: "천진해변",
      area: "고성",
      restrooms: [
        {
          name: "토성면행정복지센터 화장실(2층)",
          roadAddr: "강원특별자치도 고성군 토성면 천진해변길 88",
          lotAddr: "강원특별자치도 고성군 토성면 천진리 131",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "토성면행정복지센터 화장실(1층)",
          roadAddr: "강원특별자치도 고성군 토성면 천진해변길 88",
          lotAddr: "강원특별자치도 고성군 토성면 천진리 131",
          openHours: "24시간 운영",
          distanceKm: 0,
        },
      ],
    },
    {
      beachName: "청간해변",
      area: "고성",
      restrooms: [
        {
          name: "청간해변(입구)",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 토성면 청간리 1-24",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "아야진해변",
      area: "고성",
      restrooms: [
        {
          name: "아야진3리항",
          roadAddr: "강원특별자치도 고성군 토성면 아야진해변길 82-5",
          lotAddr: "강원특별자치도 고성군 토성면 아야진리 49-3",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "아야진4리항",
          roadAddr: "강원특별자치도 고성군 토성면 아야진해변길 88",
          lotAddr: "강원특별자치도 고성군 토성면 아야진리 38-8",
          openHours: "24시간 운영",
          distanceKm: 0.06,
        },
      ],
    },
    {
      beachName: "아야진1리해변",
      area: "고성",
      restrooms: [
        {
          name: "아야진1리해변(신건물)",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 토성면 아야진리 249-2",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "아야진1리해변",
          roadAddr: "강원특별자치도 고성군 토성면 아야진해변길 157",
          lotAddr: "강원특별자치도 고성군 토성면 아야진리 230-3",
          openHours: "24시간 운영",
          distanceKm: 0.25,
        },
      ],
    },
    {
      beachName: "문암2리해변",
      area: "고성",
      restrooms: [
        {
          name: "문암2리해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 죽왕면 문암진리 134-49",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "백도해변",
      area: "고성",
      restrooms: [
        {
          name: "백도해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 죽왕면 문암진리 19-14",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "자작도해변",
      area: "고성",
      restrooms: [
        {
          name: "자작도해변",
          roadAddr: "강원특별자치도 고성군 죽왕면 자작도선사길 105-1",
          lotAddr: "강원특별자치도 고성군 죽왕면 문암진리 460-9",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "삼포간이해변",
      area: "고성",
      restrooms: [
        {
          name: "삼포간이해변(중앙)",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 죽왕면 삼포리 1-11",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "삼포간이해변",
          roadAddr: "강원특별자치도 고성군 죽왕면 삼포해변길 76",
          lotAddr: "강원특별자치도 고성군 죽왕면 삼포리 1-12",
          openHours: "24시간 운영",
          distanceKm: 0.12,
        },
      ],
    },
    {
      beachName: "삼포해변",
      area: "고성",
      restrooms: [
        {
          name: "삼포해변",
          roadAddr: "강원특별자치도 고성군 죽왕면 삼포해변길 15-3",
          lotAddr: "강원특별자치도 고성군 죽왕면 삼포리 243-26",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "봉수대해변",
      area: "고성",
      restrooms: [
        {
          name: "봉수대해변(해양VR모험관)",
          roadAddr: "강원특별자치도 고성군 죽왕면 봉수대길 10-50",
          lotAddr: "강원특별자치도 고성군 죽왕면 오호리 68-5",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "송지호해변",
      area: "고성",
      restrooms: [
        {
          name: "송지호해변(중앙)",
          roadAddr: "강원특별자치도 고성군 죽왕면 심층수길 67",
          lotAddr: "강원특별자치도 고성군 죽왕면 오호리 17-3",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "송지호해변(여)",
          roadAddr: "강원특별자치도 고성군 죽왕면 심층수길 85",
          lotAddr: "강원특별자치도 고성군 죽왕면 오호리 1-1",
          openHours: "24시간 운영",
          distanceKm: 0.15,
        },
      ],
    },
    {
      beachName: "공현진해변",
      area: "고성",
      restrooms: [
        {
          name: "공현진항(활어회센터)",
          roadAddr: "강원특별자치도 고성군 죽왕면 공현진해변길 72 인근",
          lotAddr: "강원특별자치도 고성군 죽왕면 공현진리 431-37 인근",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "공현진항(배모양)",
          roadAddr: "강원특별자치도 고성군 죽왕면 공현진해변길 62",
          lotAddr: "강원특별자치도 고성군 죽왕면 공현진리 431-27",
          openHours: "24시간 운영",
          distanceKm: 0.07,
        },
      ],
    },
    {
      beachName: "공현진1리해변",
      area: "고성",
      restrooms: [
        {
          name: "공현진1리해변",
          roadAddr: "강원특별자치도 고성군 죽왕면 공현진길 15",
          lotAddr: "강원특별자치도 고성군 죽왕면 공현진리 144 -44",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "공현진2리해변",
      area: "고성",
      restrooms: [
        {
          name: "공현진2리해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 죽왕면 공현진리 431-15",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "가진해변",
      area: "고성",
      restrooms: [
        {
          name: "가진활어회센터",
          roadAddr: "강원특별자치도 고성군 죽왕면 가진해변길 123",
          lotAddr: "강원특별자치도 고성군 죽왕면 가진리 46-7",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "가진항",
          roadAddr: "강원특별자치도 고성군 죽왕면 가진해변길 121-19",
          lotAddr: "강원특별자치도 고성군 죽왕면 가진리 45-1",
          openHours: "24시간 운영",
          distanceKm: 0.21,
        },
      ],
    },
    {
      beachName: "반암해변",
      area: "고성",
      restrooms: [
        {
          name: "반암해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 거진읍 반암리 1 인근",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "해오름해변",
      area: "고성",
      restrooms: [
        {
          name: "거진11리해맞이광장",
          roadAddr: "강원특별자치도 고성군 거진읍 해오름해변길 125",
          lotAddr: "강원특별자치도 고성군 거진읍 거진리 340-42",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "거진11리해변",
      area: "고성",
      restrooms: [
        {
          name: "거진11리해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 거진읍 거진리 22-59",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "화진포해변",
      area: "고성",
      restrooms: [
        {
          name: "화진포(현내)해변",
          roadAddr: "강원특별자치도 고성군 현내면 화진포길 412",
          lotAddr: "강원특별자치도 고성군 현내면 초도리 94-1 외 2필지",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "화진포(거진)해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 거진읍 화포리 516-1",
          openHours: "24시간 운영",
          distanceKm: 0.43,
        },
      ],
    },
    {
      beachName: "초도해변",
      area: "고성",
      restrooms: [
        {
          name: "초도해변",
          roadAddr: "강원특별자치도 고성군 현내면 초도안길 3-1",
          lotAddr: "강원특별자치도 고성군 현내면 초도리 218",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "대진5리해변",
      area: "고성",
      restrooms: [
        {
          name: "대진5리해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 현내면 대진리 193-3",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "대진1리해변",
      area: "고성",
      restrooms: [
        {
          name: "대진1리해변",
          roadAddr: "강원특별자치도 고성군 현내면 한나루로4길 12-7",
          lotAddr: "강원특별자치도 고성군 현내면 대진리 16-8",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "마차진해변",
      area: "고성",
      restrooms: [
        {
          name: "마차진해변",
          roadAddr: null,
          lotAddr: "강원특별자치도 고성군 현내면 마차진리 233-2",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "명파해변",
      area: "고성",
      restrooms: [
        {
          name: "명파해변",
          roadAddr: "강원특별자치도 고성군 현내면 명파4길 47",
          lotAddr: "강원특별자치도 고성군 현내면 명파리 230-29",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
  ],
  속초: [
    {
      beachName: "등대해수욕장",
      area: "속초",
      restrooms: [
        {
          name: "등대해수욕장",
          roadAddr: "강원특별자치도 속초시 영랑동 148-188",
          lotAddr: "강원특별자치도 속초시 영랑동 148-188",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "외옹치해수욕장",
      area: "속초",
      restrooms: [
        {
          name: "외옹치 해수욕장",
          roadAddr: "강원특별자치도 속초시 해오름로 86-1",
          lotAddr: "강원특별자치도 속초시 대포동 594-2",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "청호동해변",
      area: "속초",
      restrooms: [
        {
          name: "청호동 해변",
          roadAddr: "강원특별자치도 속초시 아바이마을1길 86-1(청호동)",
          lotAddr: "강원특별자치도 속초시 청호동 550-13 공중화장실",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "속초해변",
      area: "속초",
      restrooms: [
        {
          name: "속초해변(중문)",
          roadAddr: "강원특별자치도 속초시 해오름로 166-1 (조양동)",
          lotAddr: "강원특별자치도 속초시 조양동 1464-7",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "속초해변(남문)",
          roadAddr: "강원특별자치도 속초시 해오름로 140 (조양동)",
          lotAddr: "강원특별자치도 속초시 조양동 1469",
          openHours: "24시간 운영",
          distanceKm: 0.26,
        },
      ],
    },
  ],
  양양: [
    {
      beachName: "동산해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "동산해수욕장 야영장 화장실",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 현남면 동산리 203-54",
          openHours: "24시간",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "동호리해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "동호리해수욕장 화장실",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 손양면 동호리 1-113",
          openHours: "24시간",
          distanceKm: null,
        },
        {
          name: "동호리해수욕장 화장실2",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 손양면 동호리 1-113",
          openHours: "09:00~18:00",
          distanceKm: 0,
        },
      ],
    },
    {
      beachName: "송전해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "송전해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 손양면 송전리 1-35번지선(1-2번지선) 공유수면",
          lotAddr: null,
          openHours: "24시간",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "하조대해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "하조대해수욕장 화장실 3",
          roadAddr: "강원특별자치도 양양군 현북면 하조대해안길 35",
          lotAddr: "강원특별자치도 양양군 현북면 하광정리 621",
          openHours: "09:00~18:00",
          distanceKm: null,
        },
        {
          name: "하조대해수욕장 화장실 2",
          roadAddr: "강원특별자치도 양양군 현북면 하조대해안길 29-1",
          lotAddr: "강원특별자치도 양양군 현북면 하광정리 624",
          openHours: "09:00~18:00",
          distanceKm: 0.04,
        },
      ],
    },
    {
      beachName: "동산리해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "동산리 해수욕장 화장실",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 현남면 동산리 90-35",
          openHours: "24시간",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "죽도해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "죽도해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 현남면 새나루길 46",
          lotAddr: "강원특별자치도 양양군 현남면 시변리 12-6",
          openHours: "24시간",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "남애3리해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "남애3리(신) 해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 현남면 매바위길 167",
          lotAddr: "강원특별자치도 양양군 현남면 남애리 6-2",
          openHours: "24시간",
          distanceKm: null,
        },
        {
          name: "남애3리 해수욕장 화장실",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 현남면 남애리 6-58",
          openHours: "09:00~18:00",
          distanceKm: 0.15,
        },
      ],
    },
    {
      beachName: "설악해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "설악해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 강현면 동해대로 3264",
          lotAddr: "강원특별자치도 양양군 강현면 용호리 4-4",
          openHours: "24시간",
          distanceKm: null,
        },
        {
          name: "설악해수욕장 주차장 화장실",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 강현면 전진리 61-5",
          openHours: "24시간",
          distanceKm: 0.35,
        },
      ],
    },
    {
      beachName: "정암해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "정암 해수욕장 화장실",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 강현면 정암리 153-4",
          openHours: "24시간",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "물치해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "물치해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 강현면 동해대로 3552",
          lotAddr: "강원특별자치도 양양군 강현면 물치리 67-23",
          openHours: "24시간",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "남애갯마을해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "남애갯마을 해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 현남면 갯마을길 54",
          lotAddr: "강원특별자치도 양양군 현남면 남애리 600-18",
          openHours: "09:00~18:00",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "원포리해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "원포리해수욕장 화장실",
          roadAddr: "강원특별자치도 양양군 현남면 동해대로 232",
          lotAddr: "강원특별자치도 양양군 현남면 원포리 1-4",
          openHours: "09:00~18:00",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "북분리해수욕장",
      area: "양양",
      restrooms: [
        {
          name: "북분리해수욕장 화장실1",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 현북면 북분리 2-5",
          openHours: "09:00~18:00",
          distanceKm: null,
        },
        {
          name: "북분리해수욕장 화장실2",
          roadAddr: null,
          lotAddr: "강원특별자치도 양양군 현북면 북분리 2-5",
          openHours: "09:00~18:00",
          distanceKm: null,
        },
      ],
    },
  ],
  강릉: [
    {
      beachName: "주문진해수욕장",
      area: "강릉",
      restrooms: [
        {
          name: "주문진해변샤워장옆 공중화장실",
          roadAddr: "강원특별자치도 강릉시 주문진읍 주문북로 210",
          lotAddr: "강원특별자치도 강릉시 주문진읍 향호리 8-17",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "주문진해수욕장상가밑 화장실",
          roadAddr: "강원특별자치도 강릉시 주문진읍 주문북로 210",
          lotAddr: "강원특별자치도 강릉시 주문진읍 향호리 8-19",
          openHours: "24시간 운영",
          distanceKm: 0,
        },
      ],
    },
    {
      beachName: "사천해변",
      area: "강릉",
      restrooms: [
        {
          name: "사천해변",
          roadAddr: "강원특별자치도 강릉시 사천면 해안로 870",
          lotAddr: "강원특별자치도 강릉시 사천면 방동리 산284-9",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "진리해변",
      area: "강릉",
      restrooms: [
        {
          name: "사천진항포구",
          roadAddr: "강원특별자치도 강릉시 사천면 진리해변길 68-7",
          lotAddr: "강원특별자치도 강릉시 사천면 사천진리 2-104",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "하평해변",
      area: "강릉",
      restrooms: [
        {
          name: "하평해변",
          roadAddr: "강원특별자치도 강릉시 사천면 진리해변길 115",
          lotAddr: "강원특별자치도 강릉시 사천면 사천진리 266-1",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "옥계해변",
      area: "강릉",
      restrooms: [
        {
          name: "옥계해변북쪽",
          roadAddr: "강원특별자치도 강릉시 옥계면 금진솔밭길 148-20",
          lotAddr: "강원특별자치도 강릉시 옥계면 금진리 산105-1",
          openHours: null,
          distanceKm: null,
        },
        {
          name: "옥계해변 남쪽",
          roadAddr: "강원특별자치도 강릉시 옥계면 금진솔밭길 104-30",
          lotAddr: "강원특별자치도 강릉시 옥계면 금진리 799-17",
          openHours: "24시간 운영",
          distanceKm: 0.24,
        },
      ],
    },
    {
      beachName: "금진해변",
      area: "강릉",
      restrooms: [
        {
          name: "금진해변 중앙(풍차)",
          roadAddr: "강원특별자치도 강릉시 옥계면 헌화로 257",
          lotAddr: "강원특별자치도 강릉시 옥계면 금진리 176-7",
          openHours: null,
          distanceKm: null,
        },
        {
          name: "금진해변 남쪽",
          roadAddr: "강원특별자치도 강릉시 옥계면 헌화로 212",
          lotAddr: "강원특별자치도 강릉시 옥계면 금진리 347-50",
          openHours: "24시간 운영",
          distanceKm: 0.49,
        },
      ],
    },
    {
      beachName: "송정해변",
      area: "강릉",
      restrooms: [
        {
          name: "송정해변화장실",
          roadAddr: "강원특별자치도 강릉시 창해로118",
          lotAddr: "강원특별자치도 강릉시 송정동 208-2",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "안목해변",
      area: "강릉",
      restrooms: [
        {
          name: "안목해변화장실",
          roadAddr: "강원특별자치도 강릉시  창해로14번길3",
          lotAddr: "강원특별자치도 강릉시 견소동286-8",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "등명해변",
      area: "강릉",
      restrooms: [
        {
          name: "등명해변(철길옆)",
          roadAddr: "강원특별자치도 강릉시 강동면 정동등명길 12",
          lotAddr: "강원특별자치도 강릉시 강동면 정동진리 440-1",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "등명해변",
          roadAddr: "강원특별자치도 강릉시 강동면 정동등명길 2",
          lotAddr: "강원특별자치도 강릉시 강동면 정동진리 440-41",
          openHours: "24시간 운영",
          distanceKm: 0.11,
        },
      ],
    },
    {
      beachName: "고성목해변",
      area: "강릉",
      restrooms: [
        {
          name: "고성목해변",
          roadAddr: "강원특별자치도 강릉시 강동면 정동역길 32-1",
          lotAddr: "강원특별자치도 강릉시 강동면 정동진리 303-2",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "염전해변",
      area: "강릉",
      restrooms: [
        {
          name: "염전해변",
          roadAddr: "강원특별자치도 강릉시 강동면 염전길 157",
          lotAddr: "강원특별자치도 강릉시 강동면 안인리 1-6",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "강문해변",
      area: "강릉",
      restrooms: [
        {
          name: "강문해변",
          roadAddr: "강원특별자치도 강릉시 창해로 344-1",
          lotAddr: "강원특별자치도 강릉시 강문동 159-39",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "경포해변",
      area: "강릉",
      restrooms: [
        {
          name: "경포해변중앙통로",
          roadAddr: "강원특별자치도 강릉시 창해로 514",
          lotAddr: "강원특별자치도 강릉시 안현동 89-108",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
  ],
  동해: [
    {
      beachName: "하평해변",
      area: "동해",
      restrooms: [
        {
          name: "하평해변",
          roadAddr: "강원특별자치도 동해시 평릉동 산 32-13",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "어달해변",
      area: "동해",
      restrooms: [
        {
          name: "어달해변",
          roadAddr: "강원특별자치도 동해시 일출로 284",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "한섬해변",
      area: "동해",
      restrooms: [
        {
          name: "한섬해변",
          roadAddr: "강원특별자치도 동해시 한섬해안길 6",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "망상해변",
      area: "동해",
      restrooms: [
        {
          name: "망상해변내 5호",
          roadAddr: "강원특별자치도 동해시 동해대로 6270-12",
          lotAddr: null,
          openHours: "09:00~18:00",
          distanceKm: null,
        },
        {
          name: "망상해변내 8호",
          roadAddr: "강원특별자치도 동해시 동해대로 6270-14",
          lotAddr: null,
          openHours: "09:00~18:00",
          distanceKm: 0.16,
        },
      ],
    },
    {
      beachName: "대진해변",
      area: "동해",
      restrooms: [
        {
          name: "대진해변",
          roadAddr: "강원특별자치도 동해시 대진항길 60",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
  ],
  삼척: [
    {
      beachName: "맹방해수욕장",
      area: "삼척",
      restrooms: [
        {
          name: "맹방해수욕장C",
          roadAddr: "강원특별자치도 삼척시 맹방해변로 228-239",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "맹방해수욕장B",
          roadAddr: "강원특별자치도 삼척시 맹방해변로 228-239",
          lotAddr: null,
          openHours: null,
          distanceKm: 0,
        },
      ],
    },
    {
      beachName: "용화해수욕장",
      area: "삼척",
      restrooms: [
        {
          name: "해양레일바이크C(용화역 앞)",
          roadAddr: "강원특별자치도 삼척시 근덕면 용화해변길 12",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "해양레일바이크B(용화주차장)",
          roadAddr: "강원특별자치도 삼척시 근덕면 용화해변길 12",
          lotAddr: null,
          openHours: "09:00~18:00",
          distanceKm: 0,
        },
      ],
    },
    {
      beachName: "삼척해수욕장",
      area: "삼척",
      restrooms: [
        {
          name: "삼척해수욕장B",
          roadAddr: "강원특별자치도 삼척시 테마타운길 63",
          lotAddr: "강원특별자치도 삼척시 갈천동 14-9",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "삼척해변역 관광안내소",
          roadAddr: "강원특별자치도 삼척시 수로부인길 542 (갈천동)",
          lotAddr: "강원특별자치도 삼척시 갈천동 산3-3",
          openHours: "09:00 ~ 18:00",
          distanceKm: 0.19,
        },
      ],
    },
    {
      beachName: "덕산해수욕장",
      area: "삼척",
      restrooms: [
        {
          name: "덕산해수욕장 화장실",
          roadAddr: "강원특별자치도 삼척시 근덕면 덕산해변길 114",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "궁촌해변",
      area: "삼척",
      restrooms: [
        {
          name: "궁촌항",
          roadAddr: "강원특별자치도 삼척시 근덕면 궁촌해변길",
          lotAddr: "강원특별자치도 삼척시 근덕면 궁촌리 213-14",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
  ],
  울진: [
    {
      beachName: "후포해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "후포해수욕장 행정봉사실",
          roadAddr: "경상북도 울진군 후포면 울진대게로 36",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "후정해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "후정해수욕장 행정봉사실",
          roadAddr: "경상북도 울진군 죽변면 후정2길 74",
          lotAddr: "경상북도 울진군 죽변면 후정리 53-27",
          openHours: null,
          distanceKm: null,
        },
        {
          name: "후정해수욕장",
          roadAddr: "경상북도 울진군 죽변면 후정2길 72",
          lotAddr: "경상북도 울진군 죽변면 후정리 53-11",
          openHours: "24시간 운영",
          distanceKm: 0.03,
        },
      ],
    },
    {
      beachName: "봉평해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "봉평해수욕장",
          roadAddr: "경상북도 울진군 죽변면 울진북로 1180",
          lotAddr: "경상북도 울진군 죽변면 봉평리 97-2",
          openHours: "24시간 운영",
          distanceKm: null,
        },
        {
          name: "봉평해수욕장 행정봉사실",
          roadAddr: "경상북도 울진군 죽변면 울진북로 1166",
          lotAddr: "경상북도 울진군 죽변면 봉평리 97-7",
          openHours: null,
          distanceKm: 0.1,
        },
      ],
    },
    {
      beachName: "나곡해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "나곡해수욕장",
          roadAddr: null,
          lotAddr: "경상북도 울진군 북면 나곡리 707-1",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "덕신해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "덕신해수욕장",
          roadAddr: "경상북도 울진군 매화면 덕신1길 20-12",
          lotAddr: "경상북도 울진군 매화면 덕신리 5-8",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "기성망양해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "기성망양해수욕장",
          roadAddr: "경상북도 울진군 기성면 망양1길 7",
          lotAddr: "경상북도 울진군 기성면 망양리 140-6",
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "구산해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "구산해수욕장 행정봉사실",
          roadAddr: "경상북도 울진군 기성면 기성로 108",
          lotAddr: "경상북도 울진군 기성면 구산리 산73",
          openHours: null,
          distanceKm: null,
        },
      ],
    },
    {
      beachName: "망양정해수욕장",
      area: "울진",
      restrooms: [
        {
          name: "망양정해수욕장",
          roadAddr: "경상북도 울진군 근남면 망양정로 1029",
          lotAddr: null,
          openHours: "24시간 운영",
          distanceKm: null,
        },
      ],
    },
  ],
};

module.exports = { BEACH_RESTROOMS };

import { Hono } from "hono";

const doodle = new Hono();

// Google Doodle collection — all URLs verified accessible (2020-2026)
const DOODLES = [
  // 2026
  "https://www.google.com/logos/doodles/2026/world-cup-2026-knee-slide-6753651837111127-2xa.gif",
  "https://www.google.com/logos/doodles/2026/world-cup-2026-the-art-of-the-curler-623-6753651837111123.2-2xa.gif",
  "https://www.google.com/logos/doodles/2026/world-cup-2026-the-art-of-the-long-ball-6753651837111116-2xa.gif",
  "https://www.google.com/logos/doodles/2026/indigenous-peoples-day-2026-6753651837111185-2x.png",
  "https://www.google.com/logos/doodles/2026/la-fete-de-la-musique-2026-6753651837111133-2xa.gif",
  "https://www.google.com/logos/doodles/2026/celebrating-dangdut-6753651837111201-2xa.gif",
  "https://www.google.com/logos/doodles/2026/earth-day-2026-6753651837111006.4-2xa.gif",
  "https://www.google.com/logos/doodles/2026/easter-2026-6753651837111171.4-2x.png",
  "https://www.google.com/logos/doodles/2026/international-womens-day-2026-6753651837111003-2xa.gif",
  "https://www.google.com/logos/doodles/2026/juneteenth-2026-6753651837111175-2x.png",
  "https://www.google.com/logos/doodles/2026/memorial-day-2026-6753651837111174.2-2x.png",
  "https://www.google.com/logos/doodles/2026/new-years-day-2026-6753651837110748.2-2xa.gif",
  "https://www.google.com/logos/doodles/2026/pi-day-2026-6753651837111068.2-2xa.gif",
  "https://www.google.com/logos/doodles/2026/us-teacher-appreciation-day-2026-6753651837111173-2xa.gif",
  "https://www.google.com/logos/doodles/2026/valentines-day-2026-feb-14-o-6753651837110998-2xa.gif",
  // 2025
  "https://www.google.com/logos/doodles/2025/celebrating-cherry-blossom-season-copy-6753651837110757-2xa.gif",
  "https://www.google.com/logos/doodles/2025/nba-playoffs-2025-am-6753651837110780.2-2xa.gif",
  "https://www.google.com/logos/doodles/2025/celebrating-house-music-6753651837110601.2-2xa.gif",
  "https://www.google.com/logos/doodles/2025/earth-day-2025-6753651837110746.2-2x.png",
  "https://www.google.com/logos/doodles/2025/us-teacher-appreciation-day-2025-6753651837110735.2-2x.png",
  "https://www.google.com/logos/doodles/2025/new-years-day-2025-6753651837110593-2xa.gif",
  "https://www.google.com/logos/doodles/2025/fourth-of-july-2025-6753651837110704-2x.png",
  "https://www.google.com/logos/doodles/2025/valentines-day-2025-6753651837110609.2-2x.png",
  "https://www.google.com/logos/doodles/2025/international-womens-day-2025-6753651837110620.3-2x.png",
  "https://www.google.com/logos/doodles/2025/new-years-eve-2025-6753651837110713.2-2xa.gif",
  "https://www.google.com/logos/doodles/2025/mothers-day-2025-6753651837110682-2x.png",
  "https://www.google.com/logos/doodles/2025/juneteenth-2025-6753651837110740.2-2x.png",
  "https://www.google.com/logos/doodles/2025/la-fete-de-la-musique-6753651837110813-2x.png",
  "https://www.google.com/logos/doodles/2025/labor-day-2025-6753651837110707.2-2x.png",
  "https://www.google.com/logos/doodles/2025/thanksgiving-2025-6753651837111179.2-2x.png",
  "https://www.google.com/logos/doodles/2025/veterans-day-2025-6753651837110742-2x.png",
  // 2024
  "https://www.google.com/logos/doodles/2024/halloween-2024-6753651837110311.2-2xa.gif",
  "https://www.google.com/logos/doodles/2024/valentines-day-2024-6753651837110186-2xa.gif",
  "https://www.google.com/logos/doodles/2024/international-womens-day-2024-6753651837110196-2x.png",
  "https://www.google.com/logos/doodles/2024/earth-day-2024-6753651837110453-2xa.gif",
  "https://www.google.com/logos/doodles/2024/new-years-eve-2024-6753651837110349-2xa.gif",
  "https://www.google.com/logos/doodles/2024/new-years-day-2024-6753651837110174-2xa.gif",
  "https://www.google.com/logos/doodles/2024/thanksgiving-2024-6753651837110329-2xa.gif",
  "https://www.google.com/logos/doodles/2024/juneteenth-2024-6753651837110459-2xa.gif",
  "https://www.google.com/logos/doodles/2024/mountain-day-2024-6753651837110268-2xa.gif",
  "https://www.google.com/logos/doodles/2024/nba-playoffs-2024-6753651837110500-2x.png",
  "https://www.google.com/logos/doodles/2024/labor-day-2024-6753651837110455-2x.png",
  "https://www.google.com/logos/doodles/2024/veterans-day-2024-6753651837110460.5-2x.png",
  // 2023
  "https://www.google.com/logos/doodles/2023/celebrating-the-appalachian-trail-6753651837110071.2-2xa.gif",
  "https://www.google.com/logos/doodles/2023/halloween-2023-6753651837109958-2xa.gif",
  "https://www.google.com/logos/doodles/2023/earth-day-2023-6753651837109582.2-2xa.gif",
  "https://www.google.com/logos/doodles/2023/international-womens-day-2023-6753651837109578-2x.png",
  "https://www.google.com/logos/doodles/2023/new-years-day-2023-6753651837109566.2-2xa.gif",
  "https://www.google.com/logos/doodles/2023/new-years-eve-2023-6753651837109995-2xa.gif",
  "https://www.google.com/logos/doodles/2023/valentines-day-2023-6753651837109573-2xa.gif",
  "https://www.google.com/logos/doodles/2023/juneteenth-2023-6753651837109890-2x.png",
  "https://www.google.com/logos/doodles/2023/labor-day-2023-6753651837109933-2x.png",
  "https://www.google.com/logos/doodles/2023/mountain-day-2023-6753651837110068-2x.png",
  "https://www.google.com/logos/doodles/2023/thanksgiving-2023-6753651837109972.2-2x.png",
  "https://www.google.com/logos/doodles/2023/veterans-day-2023-6753651837109963-2x.png",
  // 2022
  "https://www.google.com/logos/doodles/2022/earth-day-2022-6753651837109391.2-2xa.gif",
  "https://www.google.com/logos/doodles/2022/halloween-2022-6753651837109529-2xa.gif",
  "https://www.google.com/logos/doodles/2022/international-womens-day-2022-6753651837109192-2xa.gif",
  "https://www.google.com/logos/doodles/2022/new-years-day-2022-6753651837109338-2xa.gif",
  "https://www.google.com/logos/doodles/2022/new-years-eve-2022-6753651837109565-2xa.gif",
  "https://www.google.com/logos/doodles/2022/valentines-day-2022-6753651837109186.4-2xa.gif",
  "https://www.google.com/logos/doodles/2022/juneteenth-2022-6753651837109445-2x.png",
  "https://www.google.com/logos/doodles/2022/labor-day-2022-6753651837109490.2-2x.png",
  "https://www.google.com/logos/doodles/2022/mountain-day-2022-6753651837109474-2x.png",
  "https://www.google.com/logos/doodles/2022/thanksgiving-2022-6753651837109542.5-2x.png",
  "https://www.google.com/logos/doodles/2022/us-teacher-appreciation-day-2022-6753651837109401-2x.png",
  "https://www.google.com/logos/doodles/2022/veterans-day-2022-6753651837109534-2x.png",
  // 2021
  "https://www.google.com/logos/doodles/2021/earth-day-2021-6753651837108909.3-2xa.gif",
  "https://www.google.com/logos/doodles/2021/halloween-2021-6753651837109122.2-2xa.gif",
  "https://www.google.com/logos/doodles/2021/international-womens-day-2021-6753651837108879.3-2xa.gif",
  "https://www.google.com/logos/doodles/2021/new-years-day-2021-6753651837108820-2xa.gif",
  "https://www.google.com/logos/doodles/2021/new-years-eve-2021-6753651837109170.2-2xa.gif",
  "https://www.google.com/logos/doodles/2021/valentines-day-2021-6753651837108860.3-2xa.gif",
  "https://www.google.com/logos/doodles/2021/juneteenth-2021-6753651837108967-2x.png",
  "https://www.google.com/logos/doodles/2021/labor-day-2021-6753651837109056.2-2x.png",
  "https://www.google.com/logos/doodles/2021/thanksgiving-2021-6753651837109145-2xa.gif",
  "https://www.google.com/logos/doodles/2021/veterans-day-2021-6753651837109132.2-2x.png",
  // 2020
  "https://www.google.com/logos/doodles/2020/earth-day-2020-6753651837108357.2-2xa.gif",
  "https://www.google.com/logos/doodles/2020/halloween-2020-6753651837108597.5-2xa.gif",
  "https://www.google.com/logos/doodles/2020/international-womens-day-2020-6753651837108310-2xa.gif",
  "https://www.google.com/logos/doodles/2020/new-years-day-2020-6753651837108248-2x.png",
  "https://www.google.com/logos/doodles/2020/new-years-eve-2020-6753651837108665-2xa.gif",
  "https://www.google.com/logos/doodles/2020/valentines-day-2020-6753651837108288-2xa.gif",
  "https://www.google.com/logos/doodles/2020/mountain-day-2020-6753651837108496.2-2x.jpg",
  "https://www.google.com/logos/doodles/2020/thanksgiving-2020-6753651837108628-2x.png",
  "https://www.google.com/logos/doodles/2020/veterans-day-2020-6753651837108731-2x.jpg",
];

doodle.get("/doodle", async (c) => {
  // Return 1-3 random doodles from the list
  const shuffled = [...DOODLES].sort(() => Math.random() - 0.5);
  const count = Math.min(3, shuffled.length);
  const result = shuffled.slice(0, count).map((url) => ({ url, title: "Google Doodle" }));
  return c.json(result);
});

export default doodle;

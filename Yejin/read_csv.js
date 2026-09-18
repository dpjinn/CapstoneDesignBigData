/* =========================================================
   DevInsight AI
   GitHub CSV Data Manager

   CSV filename:
   app_id_app_name_sentiment.csv

   Example:
   70_Half-Life_negative.csv
   70_Half-Life_positive.csv
========================================================= */


/* =========================================================
   1. GitHub Repository 설정
========================================================= */

const GITHUB_CONFIG = {

    // GitHub 사용자 이름
    owner: "YOUR_GITHUB_USERNAME",

    // Repository 이름
    repo: "YOUR_REPOSITORY_NAME",

    // Branch
    branch: "main",

    // CSV가 들어있는 폴더
    dataPath: "data"
};


/* =========================================================
   2. 프로그램 상태
========================================================= */

let games = [];
let currentGame = null;

let allReviews = [];
let filteredReviews = [];

let githubFiles = [];

let currentPage = 1;
const REVIEWS_PER_PAGE = 10;


/* =========================================================
   3. GitHub API
========================================================= */

async function loadGitHubFileList() {

    const url =
        `https://api.github.com/repos/` +
        `${GITHUB_CONFIG.owner}/` +
        `${GITHUB_CONFIG.repo}/git/trees/` +
        `${GITHUB_CONFIG.branch}?recursive=1`;

    try {

        showLoading("GitHub에서 게임 데이터를 불러오는 중...");

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `GitHub API 오류: ${response.status}`
            );
        }

        const data = await response.json();

        if (data.truncated) {
            console.warn(
                "GitHub Tree API 결과가 일부 잘렸습니다."
            );
        }

        githubFiles = data.tree
            .filter(file =>
                file.type === "blob" &&
                file.path.startsWith(
                    GITHUB_CONFIG.dataPath + "/"
                ) &&
                file.path.toLowerCase().endsWith(".csv")
            );

        console.log(
            `GitHub CSV 발견: ${githubFiles.length}개`
        );

        createGameList();

        hideLoading();

    } catch (error) {

        console.error(error);

        hideLoading();

        showError(
            "GitHub CSV 데이터를 불러오지 못했습니다."
        );
    }
}


/* =========================================================
   4. 파일명에서 게임 정보 추출
========================================================= */

function parseCSVFilename(filename) {

    /*
        예:

        70_Half-Life_negative.csv

        ↓

        game_name
        Half-Life

        sentiment
        negative
    */


    const name = filename
        .replace(".csv", "")
        .replace(".CSV", "");

    const match = name.match(
        /(.+)_(positive|negative)$/i
    );

    if (!match) {
        console.warn(
            "파일명 형식이 맞지 않음:",
            filename
        );

        return null;
    }

    return {

        appId: match[1],

        gameName: match[2],

        sentiment:
            match[3].toLowerCase(),

        filename: filename
    };
}


/* =========================================================
   5. 700개 CSV → 게임 목록 자동 생성
========================================================= */

function createGameList() {

    const gameMap = new Map();

    githubFiles.forEach(file => {

        const filename =
            file.path.split("/").pop();

        const parsed =
            parseCSVFilename(filename);

        if (!parsed) return;

        if (!gameMap.has(parsed.appId)) {

            gameMap.set(
                parsed.appId,
                {
                    appId: parsed.appId,

                    gameName: parsed.gameName,

                    positiveFile: null,

                    negativeFile: null
                }
            );
        }

        const game =
            gameMap.get(parsed.appId);

        if (parsed.sentiment === "positive") {

            game.positiveFile =
                file.path;

        }

        if (parsed.sentiment === "negative") {

            game.negativeFile =
                file.path;
        }
    });


    games =
        Array.from(gameMap.values());


    games.sort((a, b) =>
        a.gameName.localeCompare(
            b.gameName
        )
    );


    console.log(
        `게임 ${games.length}개 발견`
    );


    renderGameSelector();
}


/* =========================================================
   6. 게임 검색 UI
========================================================= */

function renderGameSelector() {

    const selector =
        document.getElementById(
            "gameSelector"
        );

    if (!selector) return;


    selector.innerHTML = `

        <div class="game-selector">

            <label>
                Game
            </label>

            <input
                id="gameSearch"
                type="text"
                placeholder="Search game..."
                autocomplete="off"
            >

            <div
                id="gameList"
                class="game-list"
            ></div>

        </div>
    `;


    const input =
        document.getElementById(
            "gameSearch"
        );


    input.addEventListener(
        "input",
        () => {

            renderGameList(
                input.value
            );
        }
    );


    renderGameList("");
}


/* =========================================================
   7. 게임 목록 표시
========================================================= */

function renderGameList(keyword) {

    const list =
        document.getElementById(
            "gameList"
        );

    if (!list) return;


    const search =
        keyword
            .trim()
            .toLowerCase();


    const result =
        games
            .filter(game =>
                game.gameName
                    .toLowerCase()
                    .includes(search)
            )
            .slice(0, 30);


    if (result.length === 0) {

        list.innerHTML =
            `<div class="empty-game">
                No games found
             </div>`;

        return;
    }


    list.innerHTML =
        result.map(game => `

            <button
                class="game-item"
                onclick="selectGame('${escapeAttribute(game.appId)}')"
            >

                <span>
                    ${escapeHtml(game.gameName)}
                </span>

                <small>
                    App ${escapeHtml(game.appId)}
                </small>

            </button>

        `).join("");
}


/* =========================================================
   8. 게임 선택
========================================================= */

async function selectGame(appId) {

    const game =
        games.find(
            item =>
                item.appId === appId
        );

    if (!game) return;


    currentGame = game;


    console.log(
        "선택된 게임:",
        game
    );


    showLoading(
        `${game.gameName} 리뷰를 불러오는 중...`
    );


    try {

        const datasets = [];


        /* -----------------------------
           Positive CSV
        ----------------------------- */

        if (game.positiveFile) {

            const positive =
                await loadCSV(
                    game.positiveFile
                );

            datasets.push(
                ...positive
            );
        }


        /* -----------------------------
           Negative CSV
        ----------------------------- */

        if (game.negativeFile) {

            const negative =
                await loadCSV(
                    game.negativeFile
                );

            datasets.push(
                ...negative
            );
        }


        allReviews =
            datasets;


        filteredReviews =
            [...allReviews];


        currentPage = 1;


        console.log(
            `${game.gameName}: ` +
            `${allReviews.length} reviews`
        );


        updateDashboard();


        hideLoading();


    } catch (error) {

        console.error(error);

        hideLoading();

        showError(
            "CSV 데이터를 읽는 중 오류가 발생했습니다."
        );
    }
}


/* =========================================================
   9. CSV 다운로드
========================================================= */

async function loadCSV(path) {

    const url =
        `https://raw.githubusercontent.com/` +
        `${GITHUB_CONFIG.owner}/` +
        `${GITHUB_CONFIG.repo}/` +
        `${GITHUB_CONFIG.branch}/` +
        `${encodeURI(path)}`;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `CSV 다운로드 실패: ${path}`
        );
    }


    const text =
        await response.text();


    return parseCSV(text);
}


/* =========================================================
   10. CSV Parser
========================================================= */

function parseCSV(text) {

    /*
        Steam 리뷰에는 쉼표가 들어갈 수 있으므로
        단순 split(",")을 사용하지 않는다.

        따옴표 안의 comma를 정상적으로 처리한다.
    */


    const rows = [];

    let row = [];
    let value = "";

    let insideQuote = false;


    for (let i = 0; i < text.length; i++) {

        const char =
            text[i];

        const next =
            text[i + 1];


        /* 큰따옴표 */

        if (char === '"') {

            if (
                insideQuote &&
                next === '"'
            ) {

                value += '"';

                i++;

            } else {

                insideQuote =
                    !insideQuote;
            }

            continue;
        }


        /* 쉼표 */

        if (
            char === "," &&
            !insideQuote
        ) {

            row.push(value);

            value = "";

            continue;
        }


        /* 줄바꿈 */

        if (
            (char === "\n" ||
             char === "\r") &&
            !insideQuote
        ) {

            if (
                char === "\r" &&
                next === "\n"
            ) {
                i++;
            }

            row.push(value);

            value = "";

            if (row.length > 1 ||
                row[0] !== "") {

                rows.push(row);
            }

            row = [];

            continue;
        }


        value += char;
    }


    if (value.length > 0 ||
        row.length > 0) {

        row.push(value);

        rows.push(row);
    }


    if (rows.length === 0) {
        return [];
    }


    const headers =
        rows[0].map(
            header =>
                header
                    .trim()
                    .replace(/^\uFEFF/, "")
        );


    return rows
        .slice(1)
        .map(row => {

            const object = {};

            headers.forEach(
                (header, index) => {

                    object[header] =
                        row[index] ??
                        "";
                }
            );


            return normalizeReview(
                object
            );
        });
}


/* =========================================================
   11. CSV → Dashboard 데이터 변환
========================================================= */

function normalizeReview(row) {

    return {

        appId:
            row.app_id || "",

        game:
            row.app_name || "",

        sentiment:
            (
                row.sentiment || ""
            ).toLowerCase(),

        text:
            row.review_original || "",

        tokens:
            row.review_tokenized || "",

        timestamp:
            row.timestamp || "",

        date:
            parseDate(row.timestamp),

        /* 기존 Dashboard 호환 */

        score:
            (
                (
                    row.sentiment || ""
                ).toLowerCase() ===
                "positive"
            )
                ? 1
                : 0
    };
}


/* =========================================================
   12. 날짜 변환
========================================================= */

function parseDate(timestamp) {

    if (!timestamp) {
        return null;
    }


    const date =
        new Date(timestamp);


    if (isNaN(date.getTime())) {
        return null;
    }


    return date;
}


/* =========================================================
   13. Dashboard 업데이트
========================================================= */

function updateDashboard() {

    if (!currentGame) return;


    updateGameTitle();

    updateStatistics();

    updateReviews();

    updateCharts();

    updateIssues();

    updateComparison();
}


/* =========================================================
   14. 게임 제목
========================================================= */

function updateGameTitle() {

    const title =
        document.getElementById(
            "gameTitle"
        );

    if (title) {

        title.textContent =
            currentGame.gameName;
    }


    const description =
        document.getElementById(
            "gameDescription"
        );

    if (description) {

        description.textContent =
            `Steam review analysis · ` +
            `App ID ${currentGame.appId}`;
    }
}


/* =========================================================
   15. 통계 계산
========================================================= */

function calculateStatistics() {

    const total =
        allReviews.length;


    const positive =
        allReviews.filter(
            review =>
                review.sentiment ===
                "positive"
        ).length;


    const negative =
        allReviews.filter(
            review =>
                review.sentiment ===
                "negative"
        ).length;


    const positiveRate =
        total > 0
            ? Math.round(
                positive / total * 100
            )
            : 0;


    const negativeRate =
        total > 0
            ? Math.round(
                negative / total * 100
            )
            : 0;


    return {

        total,

        positive,

        negative,

        positiveRate,

        negativeRate
    };
}


/* =========================================================
   16. 통계 카드 업데이트
========================================================= */

function updateStatistics() {

    const stats =
        calculateStatistics();


    setText(
        "totalReviews",
        stats.total.toLocaleString()
    );


    setText(
        "positiveRate",
        `${stats.positiveRate}%`
    );


    setText(
        "negativeRate",
        `${stats.negativeRate}%`
    );


    setText(
        "negativeCount",
        stats.negative.toLocaleString()
    );
}


/* =========================================================
   17. 리뷰 목록
========================================================= */

function updateReviews() {

    const container =
        document.getElementById(
            "reviewsList"
        );

    if (!container) return;


    const start =
        (currentPage - 1) *
        REVIEWS_PER_PAGE;


    const end =
        start +
        REVIEWS_PER_PAGE;


    const pageReviews =
        filteredReviews.slice(
            start,
            end
        );


    if (pageReviews.length === 0) {

        container.innerHTML =
            `<div class="empty-review">
                No reviews found.
             </div>`;

        return;
    }


    container.innerHTML =
        pageReviews.map(
            (review, index) => `

            <div class="review-card">

                <div class="review-header">

                    <span class="
                        sentiment
                        ${review.sentiment}
                    ">
                        ${
                            review.sentiment ===
                            "positive"
                                ? "Positive"
                                : "Negative"
                        }
                    </span>

                    <span class="review-date">
                        ${formatDate(
                            review.date
                        )}
                    </span>

                </div>


                <p class="review-text">

                    ${escapeHtml(
                        review.text
                    )}

                </p>


                <div class="review-meta">

                    <span>
                        App ${escapeHtml(
                            review.appId
                        )}
                    </span>

                </div>

            </div>

        `
        ).join("");


    updatePagination();
}


/* =========================================================
   18. 리뷰 검색
========================================================= */

function searchReviews(keyword) {

    const search =
        keyword
            .trim()
            .toLowerCase();


    filteredReviews =
        allReviews.filter(
            review =>

                review.text
                    .toLowerCase()
                    .includes(search)

                ||

                review.tokens
                    .toLowerCase()
                    .includes(search)
        );


    currentPage = 1;

    updateReviews();
}


/* =========================================================
   19. 감성 필터
========================================================= */

function filterSentiment(sentiment) {

    if (
        !sentiment ||
        sentiment === "all"
    ) {

        filteredReviews =
            [...allReviews];

    } else {

        filteredReviews =
            allReviews.filter(
                review =>
                    review.sentiment ===
                    sentiment
            );
    }


    currentPage = 1;

    updateReviews();
}


/* =========================================================
   20. 리뷰 정렬
========================================================= */

function sortReviews(type) {

    filteredReviews.sort(
        (a, b) => {

            switch (type) {

                case "recent":

                    return (
                        (b.date?.getTime() || 0) -
                        (a.date?.getTime() || 0)
                    );


                case "oldest":

                    return (
                        (a.date?.getTime() || 0) -
                        (b.date?.getTime() || 0)
                    );


                case "positive":

                    return (
                        b.score -
                        a.score
                    );


                case "negative":

                    return (
                        a.score -
                        b.score
                    );


                default:

                    return 0;
            }
        }
    );


    currentPage = 1;

    updateReviews();
}


/* =========================================================
   21. Issue 분석
========================================================= */

function calculateIssues() {

    const keywords = {

        "Server Stability": [
            "서버",
            "server",
            "접속",
            "connection",
            "disconnect",
            "렉",
            "lag"
        ],

        "Matchmaking": [
            "매칭",
            "matchmaking",
            "match",
            "플레이어",
            "player"
        ],

        "Bug": [
            "버그",
            "bug",
            "오류",
            "에러",
            "error",
            "crash"
        ],

        "Gameplay": [
            "게임플레이",
            "gameplay",
            "전투",
            "combat",
            "플레이"
        ],

        "Graphics": [
            "그래픽",
            "graphic",
            "화질",
            "texture"
        ],

        "UI/UX": [
            "ui",
            "인터페이스",
            "메뉴",
            "조작",
            "controls"
        ],

        "Difficulty": [
            "난이도",
            "어렵",
            "쉬운",
            "difficulty",
            "hard",
            "easy"
        ]
    };


    const issues = [];


    for (
        const [name, words]
        of Object.entries(keywords)
    ) {

        let count = 0;

        let negative = 0;


        allReviews.forEach(
            review => {

                const text =
                    (
                        review.text +
                        " " +
                        review.tokens
                    ).toLowerCase();


                const matched =
                    words.some(
                        word =>
                            text.includes(
                                word.toLowerCase()
                            )
                    );


                if (matched) {

                    count++;


                    if (
                        review.sentiment ===
                        "negative"
                    ) {

                        negative++;
                    }
                }
            }
        );


        if (count > 0) {

            issues.push({

                name,

                count,

                negative,

                negativeRate:
                    Math.round(
                        negative /
                        count *
                        100
                    )
            });
        }
    }


    return issues.sort(
        (a, b) =>
            b.count - a.count
    );
}


/* =========================================================
   22. Issue Table
========================================================= */

function updateIssues() {

    const issues =
        calculateIssues();


    const tbody =
        document.getElementById(
            "issuesTableBody"
        );


    if (!tbody) return;


    tbody.innerHTML =
        issues.map(
            issue => `

            <tr>

                <td>
                    ${escapeHtml(
                        issue.name
                    )}
                </td>

                <td>
                    ${issue.count}
                </td>

                <td>
                    ${issue.negative}
                </td>

                <td>
                    ${issue.negativeRate}%
                </td>

            </tr>

        `
        ).join("");
}


/* =========================================================
   23. Chart 업데이트
========================================================= */

function updateCharts() {

    /*
        기존 Chart.js 코드와 연결할 수 있도록
        분석 결과만 window에 저장한다.
    */


    const monthly =
        calculateMonthlySentiment();


    window.devInsightChartData = {

        monthly,

        issues:
            calculateIssues()
    };


    /*
        기존 HTML에서 사용하는
        Chart.js 생성 함수가 있다면
        여기서 호출하면 된다.

        예:

        renderSentimentChart();
        renderIssueChart();
    */


    if (
        typeof renderSentimentChart ===
        "function"
    ) {

        renderSentimentChart(
            monthly
        );
    }


    if (
        typeof renderIssueChart ===
        "function"
    ) {

        renderIssueChart(
            calculateIssues()
        );
    }
}


/* =========================================================
   24. 월별 감성 분석
========================================================= */

function calculateMonthlySentiment() {

    const months = {};


    allReviews.forEach(
        review => {

            if (!review.date) return;


            const year =
                review.date
                    .getFullYear();


            const month =
                String(
                    review.date
                        .getMonth() + 1
                ).padStart(2, "0");


            const key =
                `${year}-${month}`;


            if (!months[key]) {

                months[key] = {

                    positive: 0,

                    negative: 0,

                    total: 0
                };
            }


            months[key].total++;


            if (
                review.sentiment ===
                "positive"
            ) {

                months[key].positive++;

            } else if (
                review.sentiment ===
                "negative"
            ) {

                months[key].negative++;
            }
        }
    );


    return Object.entries(months)
        .sort(
            ([a], [b]) =>
                a.localeCompare(b)
        )
        .map(
            ([month, value]) => ({

                month,

                positive:
                    value.positive,

                negative:
                    value.negative,

                total:
                    value.total
            })
        );
}


/* =========================================================
   25. Comparison
========================================================= */

function updateComparison() {

    /*
        현재 선택한 게임의 통계.
        다른 게임을 선택하면
        이 값이 자동으로 변경된다.
    */


    const stats =
        calculateStatistics();


    window.currentGameStats = {

        game:
            currentGame.gameName,

        total:
            stats.total,

        positive:
            stats.positiveRate,

        negative:
            stats.negativeRate
    };
}


/* =========================================================
   26. Pagination
========================================================= */

function updatePagination() {

    const totalPages =
        Math.ceil(
            filteredReviews.length /
            REVIEWS_PER_PAGE
        );


    setText(
        "currentPage",
        currentPage
    );


    setText(
        "totalPages",
        totalPages || 1
    );


    setText(
        "reviewCount",
        filteredReviews.length
    );


    const previous =
        document.getElementById(
            "previousPage"
        );


    const next =
        document.getElementById(
            "nextPage"
        );


    if (previous) {

        previous.disabled =
            currentPage <= 1;
    }


    if (next) {

        next.disabled =
            currentPage >= totalPages;
    }
}


function nextPage() {

    const totalPages =
        Math.ceil(
            filteredReviews.length /
            REVIEWS_PER_PAGE
        );


    if (
        currentPage <
        totalPages
    ) {

        currentPage++;

        updateReviews();
    }
}


function previousPage() {

    if (currentPage > 1) {

        currentPage--;

        updateReviews();
    }
}


/* =========================================================
   27. 유틸리티
========================================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;
    }
}


function formatDate(date) {

    if (!date) {
        return "-";
    }


    return date.toLocaleDateString(
        "ko-KR"
    );
}


function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeAttribute(value) {

    return String(value)
        .replace(
            /'/g,
            "\\'"
        );
}


/* =========================================================
   28. Loading
========================================================= */

function showLoading(message) {

    let loading =
        document.getElementById(
            "loadingOverlay"
        );


    if (!loading) {

        loading =
            document.createElement(
                "div"
            );

        loading.id =
            "loadingOverlay";


        loading.innerHTML = `

            <div class="loading-box">

                <div class="spinner"></div>

                <p id="loadingMessage">
                    Loading...
                </p>

            </div>
        `;


        document.body.appendChild(
            loading
        );
    }


    const messageElement =
        document.getElementById(
            "loadingMessage"
        );


    if (messageElement) {

        messageElement.textContent =
            message;
    }


    loading.style.display =
        "flex";
}


function hideLoading() {

    const loading =
        document.getElementById(
            "loadingOverlay"
        );


    if (loading) {

        loading.style.display =
            "none";
    }
}


function showError(message) {

    alert(message);
}


/* =========================================================
   29. 페이지 시작
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadGitHubFileList();
    }
);

// Tính toán đường dẫn gốc dựa trên vị trí của main.js
function getBasePath() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.src.includes('main.js')) {
            const scriptPath = script.src;
            const jsIndex = scriptPath.lastIndexOf('/js/main.js');
            if (jsIndex !== -1) {
                return scriptPath.substring(0, jsIndex);
            }
        }
    }
    return './assets';
}


function getRootPath() {
    const basePath = getBasePath();
    const assetsIndex = basePath.lastIndexOf('/assets');
    if (assetsIndex !== -1) {
        return basePath.substring(0, assetsIndex);
    }
    return '.';
}

// Cập nhật các link trong header/footer sau khi load
function updateNavLinks() {
    const rootPath = getRootPath();
    const navLinks = document.querySelectorAll('[data-href]');
    navLinks.forEach(link => {
        const dataHref = link.getAttribute('data-href');
        if (dataHref) {
            link.href = rootPath + '/' + dataHref;
        }
    });
}

function updateActiveHeaderLink() {
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const headerLinks = document.querySelectorAll('.nav-links .nav-link');

    headerLinks.forEach(link => {
        link.classList.remove('active');
        const dataHref = link.getAttribute('data-href');
        if (dataHref && currentPath.endsWith(dataHref)) {
            link.classList.add('active');
        }
    });
}

function getDetailPageUrl(card) {
    const rootPath = getRootPath();
    const nameElement = card.querySelector('.cafe-name');
    const ratingElement = card.querySelector('.cafe-rating');
    const reviewElement = card.querySelector('.cafe-badge');
    const deliveryElement = card.querySelector('.delivery-badge');

    const name = nameElement ? nameElement.textContent.trim() : 'DrinkHub Cafe';
    const ratingText = ratingElement ? ratingElement.textContent.trim() : '4.5';
    const rating = ratingText.replace(/[^0-9.]/g, '') || '4.5';
    const reviews = reviewElement ? reviewElement.textContent.replace(/\D/g, '') : '0';
    const delivery = deliveryElement ? deliveryElement.textContent.trim() : 'Giao nhanh';

    const params = new URLSearchParams({
        name,
        rating,
        reviews,
        delivery
    });

    return rootPath + '/assets/page/detailPage/detailPage.html?' + params.toString();
}

function attachCafeCardNavigation() {
    const cards = document.querySelectorAll('.cafe-card');
    if (!cards.length) {
        return;
    }

    cards.forEach(card => {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        card.addEventListener('click', () => {
            window.location.href = getDetailPageUrl(card);
        });

        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.location.href = getDetailPageUrl(card);
            }
        });
    });
}

function initDetailPageData() {
    const detailSection = document.getElementById('detail-page-content');
    if (!detailSection) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const name = params.get('name') || 'DrinkHub Cafe';
    const rating = params.get('rating') || '4.5';
    const reviews = params.get('reviews') || '0';
    const delivery = params.get('delivery') || 'Giao nhanh';

    const nameElement = document.getElementById('detail-cafe-name');
    const ratingElement = document.getElementById('detail-cafe-rating');
    const reviewElement = document.getElementById('detail-cafe-reviews');
    const deliveryElement = document.getElementById('detail-cafe-delivery');
    const titleElement = document.getElementById('detail-page-title');

    if (nameElement) {
        nameElement.textContent = name;
    }
    if (ratingElement) {
        ratingElement.textContent = rating;
    }
    if (reviewElement) {
        reviewElement.textContent = reviews;
    }
    if (deliveryElement) {
        deliveryElement.textContent = delivery;
    }
    if (titleElement) {
        titleElement.textContent = 'Chi tiet quan - ' + name;
    }
}

// Hàm load HTML từ file component
async function loadComponent(id, file) {
    const element = document.getElementById(id);
    if (element) {
        try {
            const response = await fetch(file);
            if (response.ok) {
                element.innerHTML = await response.text();
            }
        } catch (err) {
            console.error("Lỗi tải component:", err);
        }
    }
}

// Chạy khi web load xong
document.addEventListener("DOMContentLoaded", async () => {
    const basePath = getBasePath();
    await loadComponent("header-placeholder", basePath + "/component/header/header.html");
    await loadComponent("footer-placeholder", basePath + "/component/footer/footer.html");
    updateNavLinks();
    updateActiveHeaderLink();
    attachCafeCardNavigation();
    initDetailPageData();
});
// main.js - Optimized Particle Simulation using Canvas and Spatial Partitioning

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const w = canvas.width;
const h = canvas.height;
const MAX_DIST = 100;
const MAX_DIST2 = MAX_DIST * MAX_DIST;
const NODE_RADIUS = 5;
const NODE_COUNT = 800;
const SPEED = 4;
const BORDER = 30;
const fw = Math.floor(w / MAX_DIST) + 1;
const fh = Math.floor(h / MAX_DIST) + 1;
const LINK_FORCE = -0.015;

let paused = false;
let selectedType = 0;
const particles = [];
const links = [];
const fields = Array.from({ length: fw }, () =>
    Array.from({ length: fh }, () => [])
);

const ParticleTypes = [
    { color: 'rgb(250,20,20)' },
    { color: 'rgb(200,140,100)' },
    { color: 'rgb(81,170,140)' },
];

const COUPLING = [
    [1, 1, -1],
    [1, 1, 1],
    [1, 1, 1]
];

const LINKS = [1, 3, 2];
const LINKS_POSSIBLE = [
    [0, 1, 1],
    [1, 2, 1],
    [1, 1, 2]
];

class Particle {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.sx = 0;
        this.sy = 0;
        this.links = 0;
        this.bonds = new Set();
    }
    draw(ctx) {
        ctx.fillStyle = ParticleTypes[this.type].color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
    getFieldCoords() {
        return [Math.floor(this.x / MAX_DIST), Math.floor(this.y / MAX_DIST)];
    }
}

class Link {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    draw(ctx) {
        const dx = this.a.x - this.b.x;
        const dy = this.a.y - this.b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const width = 100 / Math.pow(dist, 1.3);
        ctx.strokeStyle = ParticleTypes[this.a.type].color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(this.a.x, this.a.y);
        ctx.lineTo(this.b.x, this.b.y);
        ctx.stroke();
    }
}

function addParticle(type, x, y) {
    const p = new Particle(type, x, y);
    particles.push(p);
    return p;
}

function rebuildFields() {
    for (let i = 0; i < fw; i++) {
        for (let j = 0; j < fh; j++) {
            fields[i][j] = [];
        }
    }
    for (let p of particles) {
        const [i, j] = p.getFieldCoords();
        if (fields[i] && fields[i][j]) {
            fields[i][j].push(p);
        }
    }
}

function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function logic() {
    if (paused) return;

    // 1. Обновление позиций и скоростей частиц
    for (let i = 0; i < fw; i++) {
        for (let j = 0; j < fh; j++) {
            const field = fields[i][j];
            for (const a of field) {
                a.x += a.sx;
                a.y += a.sy;
                a.sx *= 0.98;
                a.sy *= 0.98;

                // Нормализация скорости (ограничение максимальной скорости)
                const mag = Math.sqrt(a.sx * a.sx + a.sy * a.sy);
                if (mag > 1) {
                    a.sx /= mag;
                    a.sy /= mag;
                }

                // Отталкивание от границ
                if (a.x < BORDER) {
                    a.sx += SPEED * 0.05;
                    if (a.x < 0) {
                        a.x = -a.x;
                        a.sx *= -0.5;
                    }
                } else if (a.x > w - BORDER) {
                    a.sx -= SPEED * 0.05;
                    if (a.x > w) {
                        a.x = w * 2 - a.x;
                        a.sx *= -0.5;
                    }
                }
                if (a.y < BORDER) {
                    a.sy += SPEED * 0.05;
                    if (a.y < 0) {
                        a.y = -a.y;
                        a.sy *= -0.5;
                    }
                } else if (a.y > h - BORDER) {
                    a.sy -= SPEED * 0.05;
                    if (a.y > h) {
                        a.y = h * 2 - a.y;
                        a.sy *= -0.5;
                    }
                }
            }
        }
    }

    // 2. Обновление связей (разрыв слишком удалённых)
    for (let i = links.length - 1; i >= 0; i--) {
        const link = links[i];
        const a = link.a;
        const b = link.b;
        const d2 = distanceSquared(a, b);

        if (d2 > MAX_DIST2 / 4) {
            // Разрываем связь
            a.links--;
            b.links--;
            a.bonds.delete(b);
            b.bonds.delete(a);
            links.splice(i, 1); // Удаляем из массива
        } else if (d2 > NODE_RADIUS * NODE_RADIUS * 4) {
            // Притяжение по связи
            const angle = Math.atan2(a.y - b.y, a.x - b.x);
            const fx = Math.cos(angle) * LINK_FORCE * SPEED;
            const fy = Math.sin(angle) * LINK_FORCE * SPEED;
            a.sx += fx;
            a.sy += fy;
            b.sx -= fx;
            b.sy -= fy;
        }
    }

    // 3. Перемещение частиц в правильные ячейки (spatial partitioning)
    for (let i = 0; i < fw; i++) {
        for (let j = 0; j < fh; j++) {
            const field = fields[i][j];
            for (let k = field.length - 1; k >= 0; k--) {
                const a = field[k];
                const [ni, nj] = a.getFieldCoords();
                if (ni !== i || nj !== j) {
                    field.splice(k, 1); // Удаляем из текущей
                    if (ni >= 0 && ni < fw && nj >= 0 && nj < fh) {
                        fields[ni][nj].push(a); // Добавляем в новую
                    }
                }
            }
        }
    }

    // 4. Проверка взаимодействий и создание новых связей
    for (let i = 0; i < fw; i++) {
        for (let j = 0; j < fh; j++) {
            const field = fields[i][j];
            for (let i1 = 0; i1 < field.length; i1++) {
                const a = field[i1];
                let particleToLink = null;
                let minDist2 = Infinity;

                // Пара в пределах одной ячейки
                for (let j1 = i1 + 1; j1 < field.length; j1++) {
                    const b = field[j1];
                    const d2 = applyForce(a, b);
                    if (d2 !== -1 && d2 < minDist2) {
                        minDist2 = d2;
                        particleToLink = b;
                    }
                }

                // Соседние ячейки: справа, снизу, по диагонали
                for (let di = 0; di <= 1; di++) {
                    for (let dj = 0; dj <= 1; dj++) {
                        if (di === 0 && dj === 0) continue;
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni < fw && nj < fh) {
                            for (const b of fields[ni][nj]) {
                                const d2 = applyForce(a, b);
                                if (d2 !== -1 && d2 < minDist2) {
                                    minDist2 = d2;
                                    particleToLink = b;
                                }
                            }
                        }
                    }
                }

                // Создаём связь с ближайшей подходящей частицей
                if (particleToLink) {
                    a.bonds.add(particleToLink);
                    particleToLink.bonds.add(a);
                    a.links++;
                    particleToLink.links++;
                    links.push(new Link(a, particleToLink));
                }
            }
        }
    }
}

function applyForce(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d2 = dx * dx + dy * dy;

    if (d2 >= MAX_DIST2) return -1;

    let dA = COUPLING[a.type][b.type] / d2;
    let dB = COUPLING[b.type][a.type] / d2;
    let canLink = false;

    // Проверка возможности создания связи
    if (d2 < MAX_DIST2 / 4 && a.links < LINKS[a.type] && b.links < LINKS[b.type]) {
        if (!a.bonds.has(b) && !b.bonds.has(a)) {
            let countA = 0;
            a.bonds.forEach(p => { if (p.type === b.type) countA++; });
            let countB = 0;
            b.bonds.forEach(p => { if (p.type === a.type) countB++; });
            if (countA < LINKS_POSSIBLE[a.type][b.type] && countB < LINKS_POSSIBLE[b.type][a.type]) {
                canLink = true;
            }
        }
    }

    // Очень близкие частицы сильно отталкиваются
    if (d2 < NODE_RADIUS * NODE_RADIUS * 4) {
        dA = 1 / d2;
        dB = 1 / d2;
    }

    const angle = Math.atan2(dy, dx);
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);

    a.sx += fx * dA * SPEED;
    a.sy += fy * dA * SPEED;
    b.sx -= fx * dB * SPEED;
    b.sy -= fy * dB * SPEED;

    return canLink ? d2 : -1;
}

function checkPair(a, b) {
    const d2 = applyForce(a, b);
    if (d2 !== -1 && !a.bonds.has(b)) {
        a.bonds.add(b);
        b.bonds.add(a);
        a.links++;
        b.links++;
        links.push(new Link(a, b));
    }
}

function checkFieldInteractions() {
    for (let i = 0; i < fw; i++) {
        for (let j = 0; j < fh; j++) {
            const field = fields[i][j];
            for (let aIndex = 0; aIndex < field.length; aIndex++) {
                const a = field[aIndex];
                for (let bIndex = aIndex + 1; bIndex < field.length; bIndex++) {
                    checkPair(a, field[bIndex]);
                }
                for (let dx = 0; dx <= 1; dx++) {
                    for (let dy = 0; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const ni = i + dx;
                        const nj = j + dy;
                        if (ni < fw && nj < fh) {
                            for (let b of fields[ni][nj]) {
                                checkPair(a, b);
                            }
                        }
                    }
                }
            }
        }
    }
}

function updateParticles() {
    for (let p of particles) {
        p.x += p.sx;
        p.y += p.sy;
        p.sx *= 0.98;
        p.sy *= 0.98;

        const mag = Math.sqrt(p.sx * p.sx + p.sy * p.sy);
        if (mag > 1) {
            p.sx /= mag;
            p.sy /= mag;
        }

        if (p.x < BORDER) p.sx += SPEED * 0.05;
        else if (p.x > w - BORDER) p.sx -= SPEED * 0.05;
        if (p.y < BORDER) p.sy += SPEED * 0.05;
        else if (p.y > h - BORDER) p.sy -= SPEED * 0.05;
    }

    for (let i = links.length - 1; i >= 0; i--) {
        const l = links[i];
        const d2 = distanceSquared(l.a, l.b);
        if (d2 > MAX_DIST2 / 4) {
            l.a.links--;
            l.b.links--;
            l.a.bonds.delete(l.b);
            l.b.bonds.delete(l.a);
            links.splice(i, 1);
        } else if (d2 > NODE_RADIUS * NODE_RADIUS * 4) {
            const angle = Math.atan2(l.a.y - l.b.y, l.a.x - l.b.x);
            const fx = Math.cos(angle) * LINK_FORCE * SPEED;
            const fy = Math.sin(angle) * LINK_FORCE * SPEED;
            l.a.sx += fx;
            l.a.sy += fy;
            l.b.sx -= fx;
            l.b.sy -= fy;
        }
    }
}

function drawScene() {
    ctx.fillStyle = '#14374B';
    ctx.fillRect(0, 0, w, h);
    for (let link of links) link.draw(ctx);
    for (let p of particles) p.draw(ctx);
}

let lastTimestamp = 0;
let c = 0;

function animate(timestamp) {
    const delta = (timestamp - lastTimestamp) / 60;
    lastTimestamp = timestamp;

    if (!paused) {
        rebuildFields();
        logic()
        logic()
    }
    c += 1

    drawScene();
    requestAnimationFrame(animate);
}


canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    addParticle(selectedType, e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('wheel', () => {
    selectedType = (selectedType + 1) % ParticleTypes.length;
});

window.addEventListener('keydown', (e) => {
    if (e.key === ' ') paused = !paused;
});

for (let i = 0; i < NODE_COUNT; i++) {
    const type = Math.floor(Math.random() * ParticleTypes.length);
    addParticle(type, Math.random() * w, Math.random() * h);
}

animate();

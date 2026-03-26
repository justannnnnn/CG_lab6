import { mat4 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

// Получаем canvas и создаем контекст WebGL2
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('WebGL2 не поддерживается в этом браузере.');
}

// Настройки сцены
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0, 0, 0, 1);

// ----------------- Шейдеры -----------------
const vertexShaderSrc = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aVelocity;
layout(location = 2) in float aLife;

uniform float uTime;
uniform mat4 uProjection;

out float vLife;

void main() {
    vec3 pos = aPosition + aVelocity * uTime;
    gl_Position = uProjection * vec4(pos, 1.0);
    gl_PointSize = 2.0 + 3.0 * vLife;
    vLife = aLife - uTime;
}
`;

const fragmentShaderSrc = `#version 300 es
precision highp float;

in float vLife;
out vec4 fragColor;

uniform int uEffectType; // 0=firework,1=smoke,2=rain

void main() {
    float alpha = clamp(vLife, 0.0, 1.0);

    if(uEffectType == 0) {
        // Фейерверк: яркий оранжевый/красный
        fragColor = vec4(1.0, 0.5, 0.2, alpha);
    } else if(uEffectType == 1) {
        // Дым: белый, прозрачность растёт с высотой
        fragColor = vec4(1.0, 1.0, 1.0, alpha * 0.5);
    } else if(uEffectType == 2) {
        // Дождь: синий, почти непрозрачный
        fragColor = vec4(0.4, 0.6, 1.0, alpha);
    } else {
        fragColor = vec4(1.0, 0.5, 0.2, alpha);
    }
}
`;

// ----------------- Компиляция шейдеров -----------------
function compileShader(src, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

const vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
const fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}
gl.useProgram(program);

// ✅ Получаем uniform location
const uTimeLocation = gl.getUniformLocation(program, 'uTime');
const uProjectionLocation = gl.getUniformLocation(program, 'uProjection');

if (!uTimeLocation || !uProjectionLocation) {
    console.error("Не удалось найти uniform location");
}

let currentEffect = "firework";
let effectIndex = 0;
const effects = ["firework","smoke","rain"];

window.addEventListener("keydown", (e)=>{
    if(e.key === "ArrowRight") {
        effectIndex = (effectIndex+1) % effects.length;
        currentEffect = effects[effectIndex];
        particleSystem.initEffect(currentEffect);
        particleSystem.updateBuffers();
        startTime = performance.now(); // сброс времени
    }
});

// ----------------- Система частиц -----------------
class ParticleSystem {
    constructor(maxParticles) {
        this.maxParticles = maxParticles;
        this.positions = new Float32Array(maxParticles * 3);
        this.velocities = new Float32Array(maxParticles * 3);
        this.lifes = new Float32Array(maxParticles);

        this.posBuffer = gl.createBuffer();
        this.velBuffer = gl.createBuffer();
        this.lifeBuffer = gl.createBuffer();
    }

    initEffect(type) {
        for (let i = 0; i < this.maxParticles; i++) {
            if(type === "firework") {
                this.positions[i*3+0] = 0;
                this.positions[i*3+1] = 0;
                this.positions[i*3+2] = 0;

                let angle = Math.random() * Math.PI/2 - Math.PI/4; 
                let radiusAngle = Math.random() * 2 * Math.PI;
                let speed = Math.random() * 5 + 5;

                this.velocities[i*3+0] = Math.cos(angle) * Math.cos(radiusAngle) * speed;
                this.velocities[i*3+1] = Math.sin(angle) * speed; 
                this.velocities[i*3+2] = Math.cos(angle) * Math.sin(radiusAngle) * speed;

                this.lifes[i] = Math.random() * 2 + 1;
            } else if(type === "smoke") {
                this.positions[i*3+0] = (Math.random()-0.5) * 5;
                this.positions[i*3+1] = 0;
                this.positions[i*3+2] = (Math.random()-0.5) * 5;

                this.velocities[i*3+0] = (Math.random()-0.5) * 0.2;
                this.velocities[i*3+1] = Math.random() * 1 + 0.5;
                this.velocities[i*3+2] = (Math.random()-0.5) * 0.2;

                this.lifes[i] = Math.random() * 3 + 2;
            } else if(type === "rain") {
                this.positions[i*3+0] = (Math.random()-0.5) * 20;
                this.positions[i*3+1] = 10 + Math.random() * 5;
                this.positions[i*3+2] = (Math.random()-0.5) * 20;

                this.velocities[i*3+0] = 0;
                this.velocities[i*3+1] = -10 - Math.random() * 5;
                this.velocities[i*3+2] = 0;

                this.lifes[i] = 2 + Math.random() * 1;
            }
        }
    }

    updateBuffers() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.velocities, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.lifes, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    }

    render(currentTime, projection, effectType) {
        gl.uniform1f(uTimeLocation, currentTime);
        gl.uniformMatrix4fv(uProjectionLocation, false, projection);
        gl.uniform1i(gl.getUniformLocation(program,'uEffectType'), effectType);

        gl.drawArrays(gl.POINTS, 0, this.maxParticles);
    }
}

// ----------------- Инициализация -----------------
const particleSystem = new ParticleSystem(3000);
particleSystem.initEffect("firework");
particleSystem.updateBuffers();

// ----------------- Основной рендер -----------------
let startTime = performance.now();
function render() {
    let currentTime = (performance.now() - startTime) / 1000;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const projection = mat4.create();
    mat4.ortho(projection, -10, 10, -10, 10, -1, 1);

    particleSystem.render(currentTime, projection);
    requestAnimationFrame(render);
}

render();
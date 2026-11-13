//! A very small pixel-art scene painter for Reading Buddy.
//!
//! One export paints an RGBA buffer the page blits to a canvas. No dependencies and
//! no allocation: the buffer is static, so the whole thing is a few kilobytes of wasm.

const MAX_W: usize = 512;
const MAX_H: usize = 512;
const MAX: usize = MAX_W * MAX_H * 4;

static mut BUF: [u8; MAX] = [0; MAX];

const BAYER: [u8; 16] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

type Rgb = [u8; 3];

struct Palette {
    sky: &'static [Rgb],
    cloud: &'static [Rgb],
    ground: &'static [Rgb],
    dark: Rgb,
    spark: Rgb,
    horizon: f32,
    stars: bool,
    clouds: bool,
    waves: bool,
    trees: bool,
}

const MEADOW: Palette = Palette {
    sky: &[[15, 76, 158], [26, 98, 191], [51, 132, 216], [124, 188, 236], [191, 228, 248]],
    cloud: &[[255, 255, 255], [227, 240, 251], [184, 214, 240], [141, 184, 226]],
    ground: &[[140, 207, 85], [95, 174, 63], [62, 138, 55], [40, 98, 44]],
    dark: [31, 77, 44],
    spark: [246, 215, 74],
    horizon: 0.62,
    stars: false,
    clouds: true,
    waves: false,
    trees: true,
};

const SEA: Palette = Palette {
    sky: &[[12, 48, 96], [18, 72, 136], [26, 104, 176], [46, 143, 204], [92, 184, 224]],
    cloud: &[[196, 236, 248], [150, 212, 236], [108, 182, 216], [74, 150, 192]],
    ground: &[[32, 120, 140], [24, 96, 120], [18, 74, 100], [12, 54, 78]],
    dark: [8, 38, 60],
    spark: [255, 236, 150],
    horizon: 0.34,
    stars: false,
    clouds: false,
    waves: true,
    trees: false,
};

const SPACE: Palette = Palette {
    sky: &[[8, 10, 32], [16, 18, 56], [28, 26, 84], [48, 36, 110], [74, 52, 132]],
    cloud: &[[120, 92, 176], [96, 72, 150], [74, 56, 124], [56, 42, 100]],
    ground: &[[120, 104, 140], [96, 82, 118], [72, 60, 94], [50, 42, 70]],
    dark: [30, 24, 48],
    spark: [255, 244, 200],
    horizon: 0.78,
    stars: true,
    clouds: false,
    waves: false,
    trees: false,
};

const FOREST: Palette = Palette {
    sky: &[[88, 160, 190], [124, 192, 206], [166, 216, 206], [206, 232, 196], [232, 242, 206]],
    cloud: &[[255, 255, 248], [234, 244, 224], [206, 226, 196], [176, 204, 170]],
    ground: &[[104, 170, 78], [74, 138, 62], [52, 108, 52], [34, 78, 42]],
    dark: [22, 54, 34],
    spark: [255, 230, 120],
    horizon: 0.58,
    stars: false,
    clouds: true,
    waves: false,
    trees: true,
};

const NIGHT: Palette = Palette {
    sky: &[[11, 20, 48], [18, 32, 71], [27, 46, 94], [37, 61, 116], [49, 80, 138]],
    cloud: &[[61, 79, 125], [51, 68, 109], [42, 58, 96], [34, 48, 82]],
    ground: &[[44, 74, 63], [36, 63, 54], [28, 52, 45], [20, 40, 34]],
    dark: [14, 29, 24],
    spark: [216, 226, 255],
    horizon: 0.6,
    stars: true,
    clouds: false,
    waves: false,
    trees: true,
};

const DAWN: Palette = Palette {
    sky: &[[242, 163, 122], [246, 191, 138], [249, 217, 164], [252, 235, 198], [253, 243, 220]],
    cloud: &[[255, 246, 234], [251, 224, 200], [242, 195, 160], [226, 165, 133]],
    ground: &[[157, 184, 102], [125, 159, 82], [95, 133, 70], [70, 106, 60]],
    dark: [51, 80, 47],
    spark: [255, 236, 150],
    horizon: 0.64,
    stars: false,
    clouds: true,
    waves: false,
    trees: true,
};

fn palette(kind: u32) -> &'static Palette {
    match kind {
        1 => &SEA,
        2 => &SPACE,
        3 => &FOREST,
        4 => &NIGHT,
        5 => &DAWN,
        _ => &MEADOW,
    }
}

struct Rng(u32);

impl Rng {
    fn next(&mut self) -> f32 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(1 | t);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) >> 8) as f32 / 16_777_216.0
    }
    fn upto(&mut self, n: f32) -> f32 {
        self.next() * n
    }
}

struct Canvas {
    w: usize,
    h: usize,
    u: usize,
}

impl Canvas {
    fn put(&self, x: isize, y: isize, c: Rgb) {
        if x < 0 || y < 0 || x as usize >= self.w || y as usize >= self.h {
            return;
        }
        let i = (y as usize * self.w + x as usize) * 4;
        unsafe {
            let buf = &mut *core::ptr::addr_of_mut!(BUF);
            buf[i] = c[0];
            buf[i + 1] = c[1];
            buf[i + 2] = c[2];
            buf[i + 3] = 255;
        }
    }

    fn block(&self, x: isize, y: isize, c: Rgb) {
        let u = self.u as isize;
        for dy in 0..u {
            for dx in 0..u {
                self.put(x + dx, y + dy, c);
            }
        }
    }

    fn rect(&self, x: isize, y: isize, w: isize, h: isize, c: Rgb) {
        let u = self.u as isize;
        for dy in 0..h {
            for dx in 0..w {
                self.block(x + dx * u, y + dy * u, c);
            }
        }
    }

    fn bar(&self, x: isize, y: isize, w: isize, h: isize, unit: isize, c: Rgb) {
        for dy in 0..h * unit {
            for dx in 0..w * unit {
                self.put(x + dx, y + dy, c);
            }
        }
    }

    fn disc(&self, cx: isize, cy: isize, r: isize, c: Rgb) {
        for y in -r..=r {
            for x in -r..=r {
                if x * x + y * y <= r * r {
                    self.put(cx + x, cy + y, c);
                }
            }
        }
    }
}

fn shade(x: usize, y: usize, t: f32, ramp: &[Rgb]) -> Rgb {
    let steps = (ramp.len() - 1) as f32;
    let v = t.clamp(0.0, 0.9999) * steps;
    let i = v as usize;
    let edge = (BAYER[(y & 3) * 4 + (x & 3)] as f32 + 0.5) / 16.0;
    ramp[(i + if v - i as f32 > edge { 1 } else { 0 }).min(ramp.len() - 1)]
}

fn wobble(seed: f32, x: f32) -> f32 {
    (x * 0.9 + seed).sin() * 0.5 + (x * 2.3 + seed * 1.7).sin() * 0.3 + (x * 5.1 + seed).sin() * 0.2
}

/// Paint one frame. `kind` picks the place, `seed` makes it this reader's own,
/// `beat` is milliseconds since the scene opened.
#[no_mangle]
pub extern "C" fn paint(seed: u32, kind: u32, w: u32, h: u32, beat: u32) -> *const u8 {
    let w = (w as usize).clamp(8, MAX_W);
    let h = (h as usize).clamp(8, MAX_H);
    let p = palette(kind);
    let c = Canvas { w, h, u: (w / 120).max(1) };
    let t = beat as f32 / 1000.0;
    let hy = (h as f32 * p.horizon) as usize;
    let mut rng = Rng(seed | 1);

    for y in 0..h {
        for x in 0..w {
            let depth = if y < hy { y as f32 / hy.max(1) as f32 } else { 1.0 };
            c.put(x as isize, y as isize, shade(x, y, depth, p.sky));
        }
    }

    if p.stars {
        let count = ((w * hy) / (420 * c.u * c.u).max(1)).max(12);
        for i in 0..count {
            let sx = rng.upto(w as f32);
            let sy = rng.upto(hy as f32 * 0.92);
            let twinkle = ((t * 1.7) + i as f32).sin();
            if twinkle > -0.4 {
                c.block(sx as isize, sy as isize, if twinkle > 0.6 { [255, 255, 255] } else { p.spark });
            }
        }
    }

    if kind == 4 {
        let (mx, my, r) = ((w as f32 * 0.78) as isize, (h as f32 * 0.17) as isize, (h / 12).max(4) as isize);
        c.disc(mx, my, r, [246, 239, 210]);
        c.disc(mx - r / 3, my - r / 4, (r as f32 * 0.78) as isize, p.sky[1]);
    }

    if kind == 2 {
        let (px, py, r) = ((w as f32 * 0.74) as isize, (h as f32 * 0.26) as isize, (h / 9).max(5) as isize);
        c.disc(px, py, r, [226, 158, 96]);
        c.disc(px - r / 3, py - r / 3, (r as f32 * 0.42) as isize, [242, 196, 140]);
        for ring in 0..(r * 4) {
            let rx = px - r * 2 + ring;
            let ry = py + ((ring as f32 - r as f32 * 2.0) * 0.16) as isize + r / 2;
            c.put(rx, ry, [214, 186, 150]);
            c.put(rx, ry + 1, [190, 160, 126]);
        }
    }

    if p.clouds {
        for i in 0..5 {
            let drift = (t * (6.0 + i as f32 * 2.0)) % (w as f32 + 80.0);
            let cx = (rng.upto(w as f32) + drift) % (w as f32 + 80.0) - 40.0;
            let cy = h as f32 * (0.08 + rng.next() * (p.horizon - 0.22).max(0.05));
            let cw = w as f32 * (0.14 + rng.next() * 0.16);
            for y in -(cw * 0.3) as isize..(cw * 0.12) as isize {
                for x in -(cw as isize)..cw as isize {
                    let fx = x as f32 / cw;
                    let lid = -(1.0 - fx * fx).max(0.0).sqrt() * cw * 0.26 - wobble(i as f32, fx * 3.0) * cw * 0.05;
                    if (y as f32) < lid || y as f32 > cw * 0.1 {
                        continue;
                    }
                    let px = cx as isize + x;
                    let py = cy as isize + y;
                    let d = (y as f32 - lid) / (cw * 0.36).max(1.0);
                    if px >= 0 && py >= 0 {
                        c.put(px, py, shade(px as usize, py as usize, d, p.cloud));
                    }
                }
            }
        }
    }

    if p.waves {
        for y in hy..h {
            let depth = (y - hy) as f32 / (h - hy).max(1) as f32;
            for x in 0..w {
                let ripple = ((x as f32 * 0.09) + t * 1.6 + y as f32 * 0.22).sin() * 0.12;
                c.put(x as isize, y as isize, shade(x, y, depth + ripple, p.ground));
            }
        }
        for i in 0..6 {
            let fy = hy as f32 + (h - hy) as f32 * (0.2 + rng.next() * 0.7);
            let fx = ((t * (14.0 + i as f32 * 5.0) + rng.upto(w as f32)) % (w as f32 + 40.0)) - 20.0;
            c.rect(fx as isize, fy as isize, 3, 1, p.spark);
            c.rect(fx as isize - c.u as isize, fy as isize - c.u as isize, 1, 1, p.spark);
        }
    } else {
        for y in hy..h {
            let depth = (y - hy) as f32 / (h - hy).max(1) as f32;
            for x in 0..w {
                let lift = wobble(seed as f32 * 0.001, x as f32 / (w as f32 * 0.09)) * 0.06;
                c.put(x as isize, y as isize, shade(x, y, depth + lift, p.ground));
            }
        }
        for _ in 0..(w / (10 * c.u)).max(6) {
            let fx = rng.upto(w as f32);
            let fy = hy as f32 + rng.upto((h - hy) as f32);
            c.block(fx as isize, fy as isize, p.spark);
        }
    }

    if p.trees {
        for i in 0..3 {
            let tx = w as f32 * (0.07 + i as f32 * 0.33 + rng.next() * 0.06);
            let base = hy as f32 + (h - hy) as f32 * (0.04 + rng.next() * 0.1);
            let th = (h as f32 * (0.07 + rng.next() * 0.04)) as isize;
            let sway = ((t * 1.1 + i as f32).sin() * c.u as f32 * 0.6) as isize;
            let trunk = (c.u as isize).max(2);
            for y in 0..th {
                let lean = sway * y as isize / th.max(1);
                for k in 0..trunk {
                    c.put(tx as isize + lean + k, base as isize - y, p.dark);
                }
            }
            let top = base as isize - th;
            let r = (th as f32 * 0.62).max(4.0) as isize;
            c.disc(tx as isize + sway, top, r, p.ground[1]);
            c.disc(tx as isize + sway - r / 4, top - r / 3, (r as f32 * 0.62) as isize, p.ground[0]);
            c.disc(tx as isize + sway + r / 2, top + r / 2, (r as f32 * 0.3) as isize, p.ground[2]);
        }
    }

    cast(&c, p, hy, t, seed);
    core::ptr::addr_of!(BUF) as *const u8
}

/// Fig and a friend, standing on the ground, breathing with the beat.
fn cast(c: &Canvas, p: &Palette, hy: usize, t: f32, seed: u32) {
    let u = (c.h / 56).max(2) as isize;
    let ground = hy as isize + ((c.h - hy) as f32 * 0.46) as isize;
    let bob = ((t * 1.6).sin() * u as f32 * 0.8) as isize;
    let skin: Rgb = [112, 150, 88];
    let belly: Rgb = [238, 228, 196];
    let ink: Rgb = [38, 34, 26];

    let fx = (c.w as f32 * 0.3) as isize;
    let fy = ground + bob;
    c.bar(fx - u * 4, fy + u * 6, 2, 1, u, skin);
    c.bar(fx + u * 2, fy + u * 6, 2, 1, u, skin);
    c.disc(fx, fy + u * 2, u * 5, skin);
    c.disc(fx, fy + u * 3, u * 3, belly);
    c.disc(fx, fy - u * 4, u * 5, skin);
    c.bar(fx - u * 4, fy - u * 9, 1, 2, u, skin);
    c.bar(fx + u * 3, fy - u * 9, 1, 2, u, skin);
    c.disc(fx, fy - u * 2, u * 2, belly);
    let eye = (u as f32 * 0.95) as isize;
    if (t * 0.9).sin() <= 0.97 {
        for side in [-1isize, 1] {
            let ex = fx + side * u * 2;
            c.disc(ex, fy - u * 5, eye, ink);
            c.disc(ex + eye / 3, fy - u * 5 - eye / 3, (eye / 3).max(1), [255, 255, 255]);
        }
    } else {
        c.bar(fx - u * 3, fy - u * 5, 2, 1, u / 2, ink);
        c.bar(fx + u * 2, fy - u * 5, 2, 1, u / 2, ink);
    }
    c.bar(fx - u, fy - u * 3, 2, 1, u / 2, ink);

    let gx = (c.w as f32 * 0.66) as isize;
    let hop = ((t * 2.3 + 1.0).sin().max(0.0) * u as f32 * 2.2) as isize;
    let gy = ground - hop;
    let coat: Rgb = [
        (seed % 90 + 150) as u8,
        ((seed >> 8) % 70 + 140) as u8,
        ((seed >> 16) % 80 + 120) as u8,
    ];
    c.bar(gx - u * 3, gy + u * 5, 2, 1, u, coat);
    c.bar(gx + u, gy + u * 5, 2, 1, u, coat);
    c.disc(gx, gy + u * 2, u * 4, coat);
    c.disc(gx, gy - u * 3, u * 4, coat);
    c.bar(gx - u * 4, gy - u * 6, 1, 2, u, coat);
    c.bar(gx + u * 3, gy - u * 6, 1, 2, u, coat);
    for side in [-1isize, 1] {
        let ex = gx + side * u * 3 / 2;
        c.disc(ex, gy - u * 4, (u as f32 * 0.8) as isize, ink);
        c.disc(ex + u / 3, gy - u * 4 - u / 3, (u / 3).max(1), [255, 255, 255]);
    }
    c.bar(gx - u, gy - u * 2, 2, 1, u / 2, ink);

    for i in 0..3 {
        let a = t * 1.3 + i as f32 * 2.1;
        let sx = (c.w as f32 * 0.5 + a.sin() * c.w as f32 * 0.14) as isize;
        let sy = (ground as f32 - c.h as f32 * 0.16 + (a * 1.7).cos() * c.h as f32 * 0.05) as isize;
        c.block(sx, sy, p.spark);
        c.block(sx - u, sy + u, p.spark);
        c.block(sx + u, sy + u, p.spark);
    }
}

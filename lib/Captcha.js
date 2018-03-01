/** 
 * Captcha.js
 * 后端的验证码处理类，使用前端的验证码处理类代码修改而成
 * 前端的验证码处理类使用Canvas处理图像，后端使用了Jimp
 * 由于修改了部分API，使用方式与前端的略有不同
*/

const Jimp = require("jimp");

const isBlack = ([r, g, b]) => r + g + b === 0;
const isWhite = ([r, g, b]) => r + g + b === 255 * 3;
const isWhiteLike = ([r, g, b]) => r + g + b > 680;

class Captcha {

    // 传入image buffer或Jimp实例
    // promise，返回Captcha实例
    constructor(data) {
        if(data instanceof Jimp) {
            this._image = data;
            return Promise.resolve(this);
        }
        return Jimp.read(data).then(image => {
            this._image = image;
            return this;
        });
    }

    getPointRGB(x, y) {
        let idx = this._image.getPixelIndex(x, y);
        return [
            this._image.bitmap.data[idx + 0],
            this._image.bitmap.data[idx + 1],
            this._image.bitmap.data[idx + 2]
        ]
    }

    // 去掉外层边框
    eraseBorderBox() {
        let {width, height} = this._image.bitmap;
        this._image.scan(0, 0, width, height, (x, y, idx) => {
            if(x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                this._image.setPixelColor(0XFFFFFFFF, x, y);
            }
        });
        
        return this;
    }

    // 二值化
    binarization() {
        let {width, height} = this._image.bitmap;
        this._image.scan(0, 0, width, height, (x, y, idx) => {
            // 接近白色
            if(isWhiteLike(this.getPointRGB(x, y))) {
                this._image.setPixelColor(0XFFFFFFFF, x, y);
            } else {
                this._image.setPixelColor(0X000000FF, x, y);
            }
        });
        
        return this;
    }

    // 简单去除干扰点/线
    denoising() {
        let {width, height} = this._image.bitmap;
        this._image.scan(0, 0, width, height, (x, y, idx) => {

            // 不处理最外层
            if(x === 0 || y === 0 || x === width - 1 || y === height - 1) return;

            // 不处理白色点
            if(isBlack(this.getPointRGB(x, y)) === false) return;

            let [t, b, l, r] = [
                this.getPointRGB(x, y - 1),
                this.getPointRGB(x, y + 1),
                this.getPointRGB(x - 1, y),
                this.getPointRGB(x + 1, y)
            ]

            // 一个黑色点的上下为白点或左右为白点，则判断为干扰点/线
            if(isWhite(t) && isWhite(b) || isWhite(l) && isWhite(r)) {
                this._image.setPixelColor(0XFFFFFFFF, x, y);
            }
        });
        
        return this;
    }

    // 去除少量像素点组成的图形(干扰图形)
    eraseIsolatedPart() {
        let {width, height} = this._image.bitmap;
        let travelMap = new Array(width).fill().map(_ => new Array(height).fill(0));

        let travelConnectedPoint = (x, y, points) => {

            // 不处理最外层
            if(x === 0 || y === 0 || x === width - 1 || y === height - 1) return;

            if(travelMap[x][y] || isWhite(this.getPointRGB(x, y))) return;

            // 标记该点已遍历
            travelMap[x][y] = 1;
            points.push([x, y]);

            travelConnectedPoint(x + 1, y, points);
            travelConnectedPoint(x - 1, y, points);
            travelConnectedPoint(x, y + 1, points);
            travelConnectedPoint(x, y - 1, points);
        }

        this._image.scan(0, 0, width, height, (x, y, idx) => {
            let figurePoints = [];
            travelConnectedPoint(x, y, figurePoints);

            // 小于32个像素点连成的图形判断为干扰图形
            if(figurePoints.length > 0 && figurePoints.length < 32) {
                for(let [x, y] of figurePoints) {
                    this._image.setPixelColor(0XFFFFFFFF, x, y);
                }
            }
        });
        
        return this;
    }

    // 分割出验证码中的每个字符，返回字符位置信息{x1, x2, y1, y2}的数组
    // 调用此方法前需要确保已经调用dispose方法
    getCharactersPosition() {
        let {width, height} = this._image.bitmap;

        // 确定每个字符x坐标边界
        let solidCols = [];
        let lastSolidCol = -999;
        for(let x = 0; x < width; x++) {
            let isSolidCol = false;
            for(let y = 0; y < height; y++) {
                if(isBlack(this.getPointRGB(x, y))) {
                    isSolidCol = true;
                }
            }
            if(isSolidCol) { // 有黑点的列
                lastSolidCol !== x - 1 && solidCols.push(x);     // 一个字符的起始x坐标
                lastSolidCol = x;
            } else {         // 全白的列
                lastSolidCol === x - 1 && solidCols.push(x - 1); // 一个字符的结束x坐标
            }
        }
        solidCols.length % 2 && solidCols.push(width - 1);

        let poses = [];
        while(solidCols.length !== 0) {
            let x1 = solidCols.shift(),
                x2 = solidCols.shift();

            let y1, y2;
            
            // 确定起始y坐标
            for(let y = 0; y < height; y++) {
                let isSolidRow = false;
                for(let x = x1; x <= x2; x++) {
                    if(isBlack(this.getPointRGB(x, y))) {
                        isSolidRow = true;
                    }
                }
                if(isSolidRow) {
                    y1 = y;
                    break;
                }
            }

            // 确定结束y坐标
            for(let y = height - 1; y > 0; y--) {
                let isSolidRow = false;
                for(let x = x1; x <= x2; x++) {
                    if(isBlack(this.getPointRGB(x, y))) {
                        isSolidRow = true;
                    }
                }
                if(isSolidRow) {
                    y2 = y;
                    break;
                }
            }

            poses.push({x1, x2, y1, y2});
        }

        return poses;
    }

    // 分割出验证码中的每个字符，包含每个字符的Captcha实例
    // 调用此方法前需要确保已经调用dispose方法
    // promise，返回Captcha实例数组
    async sliceCharacter() {
        let slicedCharsPos = this.getCharactersPosition();
        let slicedChars = [];

        // 根据字符位置信息绘制每个字符
        for(let {x1, x2, y1, y2} of slicedCharsPos) {
            let w = x2 - x1 + 1, h = y2 - y1 + 1;
            let captcha = await new Captcha(this._image.clone().crop(x1, y1, w, h));
            slicedChars.push(captcha);
        }
        
        return slicedChars;
    }

    // 对验证码进行去边框、二值化、去噪的处理
    dispose() {
        this.eraseBorderBox();
        this.binarization();
        this.denoising();
        this.eraseIsolatedPart();

        return this;
    }

    resize(w, h) {
        this._image.resize(w, h);
        return this;
    }

    // 拼接每行像素，返回一个丢失尺寸和色彩信息的由01组成的字符串，黑色用0表示，白色用1表示
    getSampleString() {
        let arr = [];
        for(let y = 0; y < this._image.bitmap.height; y++)
        for(let x = 0; x < this._image.bitmap.width; x++) {
            arr.push(+isWhiteLike(this.getPointRGB(x, y)));
        }
        return arr.join('');
    }
}

module.exports = Captcha;
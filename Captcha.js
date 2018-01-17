let isBlack = ([r, g, b]) => r + g + b === 0;
let isWhite = ([r, g, b]) => r + g + b === 255 * 3;
let isWhiteLike = ([r, g, b]) => r + g + b > 680;

class Captcha {

    // 传入ImageData实例
    constructor(imageData) {
        this.data = imageData.data.slice();
        this.width = imageData.width;
        this.height = imageData.height;
    }

    // 取出x行y列的像素点的RGB，x、y从0开始
    getPointRGB(x, y) {
        return [
            this.data[4 * (this.width * y + x) + 0],
            this.data[4 * (this.width * y + x) + 1],
            this.data[4 * (this.width * y + x) + 2]
        ]
    }

    setPointRGB(x, y, [r, g, b]) {
        this.data[4 * (this.width * y + x) + 0] = r;
        this.data[4 * (this.width * y + x) + 1] = g;
        this.data[4 * (this.width * y + x) + 2] = b;
    }

    // 去掉外层边框
    eraseBorderBox() {
        let {width, height} = this;
        for(let i = 0; i < width; i++) {
            this.setPointRGB(i, 0, [255, 255, 255]);
            this.setPointRGB(i, height - 1, [255, 255, 255]);
        }
        for(let i = 0; i < height; i++) {
            this.setPointRGB(0, i, [255, 255, 255]);
            this.setPointRGB(width - 1, i, [255, 255, 255]);
        }
    }

    // 二值化
    binarization() {
        let {width, height} = this;
        for(let x = 0; x < width; x++) {
        for(let y = 0; y < height; y++) {
            // 接近白色
            if(isWhiteLike(this.getPointRGB(x, y))) {
                this.setPointRGB(x, y, [255, 255, 255]);
            } else {
                this.setPointRGB(x, y, [0, 0, 0]);
            }
        }
        }
    }

    // 简单去除干扰点/线
    denoising() {
        let {width, height} = this;
        for(let x = 0; x < width; x++) {
        for(let y = 0; y < height; y++) {

            // 不处理最外层
            if(x === 0 || y === 0 || x === width - 1 || y === height - 1) continue;

            // 不处理白色点
            if(isBlack(this.getPointRGB(x, y)) === false) continue;

            let [t, b, l, r] = [
                this.getPointRGB(x, y - 1),
                this.getPointRGB(x, y + 1),
                this.getPointRGB(x - 1, y),
                this.getPointRGB(x + 1, y)
            ]

            // 一个黑色点的上下为白点或左右为白点，则判断为干扰点/线
            if(isWhite(t) && isWhite(b) || isWhite(l) && isWhite(r)) {
                this.setPointRGB(x, y, [255, 255, 255]);
            }
        }
        }
    }

    // 去除少量像素点组成的图形(干扰图形)
    eraseIsolatedPart() {
        let {width, height} = this;
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

        for(let x = 0; x < width; x++) {
        for(let y = 0; y < height; y++) {
            let figurePoints = [];
            travelConnectedPoint(x, y, figurePoints);

            // 小于32个像素点连成的图形判断为干扰图形
            if(figurePoints.length > 0 && figurePoints.length < 32) {
                for(let [x, y] of figurePoints) {
                    this.setPointRGB(x, y, [255, 255, 255]);
                }
            }
        }
        }
    }

    // 分割出验证码中的每个字符，返回字符位置信息{x1, x2, y1, y2}的数组
    // 调用此方法前需要确保已经调用dispose方法
    getCharactersPosition() {
        let {width, height} = this;

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

    // 分割出验证码中的每个字符，返回ImageData实例数组，包含每个字符的数据
    // 调用此方法前需要确保已经调用dispose方法
    sliceCharacter() {
        let slicedCharsPos = this.getCharactersPosition();
        let slicedChars = [];

        // 根据字符位置信息绘制每个字符
        for(let i = 0; i < slicedCharsPos.length; i++) {
            let {x1, x2, y1, y2} = slicedCharsPos[i];
            let w = x2 - x1 + 1, h = y2 - y1 + 1;
            slicedChars.push(this.getImageData(x1, y1, w, h));
        }
        
        return slicedChars;
    }

    // 对验证码进行去边框、二值化、去噪的处理
    dispose() {
        this.eraseBorderBox();
        this.binarization();
        this.denoising();
        this.eraseIsolatedPart();
    }

    // 取回ImageData实例，可以通过填写四个参数取回部分数据
    getImageData(x = 0, y = 0, w = this.width, h = this.height) {
        let canvas = document.createElement('canvas');
        let imgData = new ImageData(this.data, this.width, this.height);
        canvas.getContext('2d').putImageData(imgData, 0, 0);
        return canvas.getContext('2d').getImageData(x, y, w, h);
    }

    // 拼接每行像素，返回一个丢失尺寸和色彩信息的由01组成的字符串，黑色用0表示，白色用1表示
    getSampleString() {
        let arr = [];
        for(let y = 0; y < this.height; y++) {
        for(let x = 0; x < this.width; x++) {
            arr.push(+isWhiteLike(this.getPointRGB(x, y)));
        }
        }
        return arr.join('');
    }

    print() {
        let str = '';
        for(let y = 0; y < this.height; y++) {
            for(let x = 0; x < this.width; x++) {
                str += +isWhiteLike(this.getPointRGB(x, y));
            }
            str += '\n';
        }
        console.log(str);
    }
}

// 重置imageData的尺寸，width和height参数分别为重置后的宽高
function resizeImageData(imageData, width, height) {
    let canvas1 = document.createElement('canvas'), ctx1 = canvas1.getContext('2d');
    let canvas2 = document.createElement('canvas'), ctx2 = canvas2.getContext('2d');
    let originWidth = imageData.width, originHeight = imageData.height;

    ctx1.putImageData(imageData, 0, 0);

    ctx2.scale(width / originWidth, height / originHeight);
    ctx2.drawImage(canvas1, 0, 0);
    return ctx2.getImageData(0, 0, width, height);
}

// 传入HTMLImageElement实例，返回对应的ImageData实例
function getImageData(image) {
    const width = image.width, height = image.height;
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    let imgData = canvas.getContext("2d").getImageData(0, 0, width, height);
    return imgData;
}
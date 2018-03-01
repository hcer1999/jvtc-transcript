module.exports = class Recognizer {
    constructor() {
        this.sampleData = [];
    }

    // 添加一个样本数据，char为样本对应的字符，sampleVal为样本字符串
    addSampleData(char, sampleVal) {
        this.sampleData.push({
            char,
            sampleVal
        });
    }

    // 返回样本数据数组
    getSampleData() {
        return this.sampleData;
    }

    // 给定一个样本字符串，从当前样本数据数组中匹配相似度最高的样本数据，并返回样本对应的字符
    matchSample(sampleVal) {
        let matched = {char: null, weight: 0};
        for(let {char, sampleVal: _sampleVal} of this.sampleData) {
            let weight = 0;
            // 两个字符串逐个字符比较，相等则权重加一
            for(let i = 0; i < sampleVal.length; i++) {
                sampleVal[i] === _sampleVal[i] && weight++;
            }
            if(matched.weight < weight) {
                matched.char = char;
                matched.weight = weight;
            }
        }
        return matched.char;
    }
}
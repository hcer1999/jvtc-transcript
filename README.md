这里是九职成绩查询系统的验证码识别相关代码分支

## 采集样本数据

> npm start

访问：http://localhost:3000/

在每个字符右方的输入框输入对应的字符，然后点击确认，即可添加一个样本数据

点击换一个按钮加载新的验证码，然后重复上面的步骤

收集完样本后点击导出数据，获取已经序列化的数据，并保存到本地文件中

下次收集可以选择导入数据，将上次的样本数据导入并继续添加

`sample-data.json`是预置的样本数据集


## 在页面中引入验证码识别

这是一个完整的例子：

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Document</title>
</head>
<body>
    <img id="captcha" src="captcha.jpg">

    <!-- 引入Captcha.js和Recognizer.js -->
    <script src="Captcha.js"></script>
    <script src="Recognizer.js"></script>

    <script>
        let cimg = document.getElementById('captcha');
        
        cimg.onload = function() {
            let recognizer = new Recognizer();

            // 获取样本数据
            fetch('sample-data.json').then(res => {
                return res.json();
            }).then(data => {
                // 加载样本数据
                for(let {char, sampleVal} of data) {
                    recognizer.addSampleData(char, sampleVal);
                }
            }).then(recognize);
        }

        function recognize() {
            let imgData = getImageData(cimg);
            let captcha = new Captcha(imgData);

            // 处理验证码
            captcha.dispose();

            // 获取验证码中切割出的字符图形数据
            let slicedChars = captcha.sliceCharacter();

            // 不识别字符数不为4的验证码(存在粘连字符)
            if(slicedChars.length !== 4) {
                alert('验证码中的字符存在粘连');
                throw Error('验证码中的字符存在粘连');
            }

            // 绘制切割出的字符图像数据
            for(let i = 0; i < slicedChars.length; i++) {
                let charImageData = slicedChars[i]

                // 将切割出的字符尺寸调整为24*24
                let normalImageData = resizeImageData(charImageData, 24, 24);
                
                // 使用切割出的字符图像创建Captcha实例
                let normalCaptcha = new Captcha(normalImageData);

                // 获取特征字符串
                let sampleString = normalCaptcha.getSampleString()
                
                // 根据特征字符串识别
                let matchedChar = recognizer.matchSample(sampleString);

                console.log('第' + i + '个字符的识别结果：' + matchedChar);
            }
        }
    </script>
</body>
</html>
```

需要注意以下几点：

- `sample-data.json`中的样本数据是使用尺寸为`24*24`的字符图像采集的，所以在分割验证码后要将字符图像尺寸调整为`24*24`

- 由于获取图片数据存在同源策略的限制，所以验证码图片必需和页面同源
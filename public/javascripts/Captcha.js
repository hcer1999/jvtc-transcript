let isBlack=([r,g,b])=>r+g+b===0;let isWhite=([r,g,b])=>r+g+b===255*3;let isWhiteLike=([r,g,b])=>r+g+b>680;
class Captcha{constructor(imageData){this.data=imageData.data.slice();this.width=imageData.width;this.height=imageData.height;}
getPointRGB(x,y){return[this.data[4*(this.width*y+x)+0],this.data[4*(this.width*y+x)+1],this.data[4*(this.width*y+x)+2]]}
setPointRGB(x,y,[r,g,b]){this.data[4*(this.width*y+x)+0]=r;this.data[4*(this.width*y+x)+1]=g;this.data[4*(this.width*y+x)+2]=b;}
eraseBorderBox(){let{width,height}=this;for(let i=0;i<width;i++){this.setPointRGB(i,0,[255,255,255]);this.setPointRGB(i,height-1,[255,255,255]);}
for(let i=0;i<height;i++){this.setPointRGB(0,i,[255,255,255]);this.setPointRGB(width-1,i,[255,255,255]);}}
binarization(){let{width,height}=this;for(let x=0;x<width;x++){for(let y=0;y<height;y++){if(isWhiteLike(this.getPointRGB(x,y))){this.setPointRGB(x,y,[255,255,255]);}else{this.setPointRGB(x,y,[0,0,0]);}}}}
denoising(){let{width,height}=this;for(let x=0;x<width;x++){for(let y=0;y<height;y++){if(x===0||y===0||x===width-1||y===height-1)continue;if(isBlack(this.getPointRGB(x,y))===false)continue;let[t,b,l,r]=[this.getPointRGB(x,y-1),this.getPointRGB(x,y+1),this.getPointRGB(x-1,y),this.getPointRGB(x+1,y)]
if(isWhite(t)&&isWhite(b)||isWhite(l)&&isWhite(r)){this.setPointRGB(x,y,[255,255,255]);}}}}
eraseIsolatedPart(){let{width,height}=this;let travelMap=new Array(width).fill().map(_=>new Array(height).fill(0));let travelConnectedPoint=(x,y,points)=>{if(x===0||y===0||x===width-1||y===height-1)return;if(travelMap[x][y]||isWhite(this.getPointRGB(x,y)))return;travelMap[x][y]=1;points.push([x,y]);travelConnectedPoint(x+1,y,points);travelConnectedPoint(x-1,y,points);travelConnectedPoint(x,y+1,points);travelConnectedPoint(x,y-1,points);}
for(let x=0;x<width;x++){for(let y=0;y<height;y++){let figurePoints=[];travelConnectedPoint(x,y,figurePoints);if(figurePoints.length>0&&figurePoints.length<32){for(let[x,y]of figurePoints){this.setPointRGB(x,y,[255,255,255]);}}}}}
getCharactersPosition(){let{width,height}=this;let solidCols=[];let lastSolidCol=-999;for(let x=0;x<width;x++){let isSolidCol=false;for(let y=0;y<height;y++){if(isBlack(this.getPointRGB(x,y))){isSolidCol=true;}}
if(isSolidCol){lastSolidCol!==x-1&&solidCols.push(x);lastSolidCol=x;}else{lastSolidCol===x-1&&solidCols.push(x-1);}}
solidCols.length%2&&solidCols.push(width-1);let poses=[];while(solidCols.length!==0){let x1=solidCols.shift(),x2=solidCols.shift();let y1,y2;for(let y=0;y<height;y++){let isSolidRow=false;for(let x=x1;x<=x2;x++){if(isBlack(this.getPointRGB(x,y))){isSolidRow=true;}}
if(isSolidRow){y1=y;break;}}
for(let y=height-1;y>0;y--){let isSolidRow=false;for(let x=x1;x<=x2;x++){if(isBlack(this.getPointRGB(x,y))){isSolidRow=true;}}
if(isSolidRow){y2=y;break;}}
poses.push({x1,x2,y1,y2});}
return poses;}
sliceCharacter(){let slicedCharsPos=this.getCharactersPosition();let slicedChars=[];for(let i=0;i<slicedCharsPos.length;i++){let{x1,x2,y1,y2}=slicedCharsPos[i];let w=x2-x1+1,h=y2-y1+1;slicedChars.push(this.getImageData(x1,y1,w,h));}
return slicedChars;}
dispose(){this.eraseBorderBox();this.binarization();this.denoising();this.eraseIsolatedPart();}
getImageData(x=0,y=0,w=this.width,h=this.height){let canvas=document.createElement('canvas');let imgData=new ImageData(this.data,this.width,this.height);canvas.getContext('2d').putImageData(imgData,0,0);return canvas.getContext('2d').getImageData(x,y,w,h);}
getSampleString(){let arr=[];for(let y=0;y<this.height;y++){for(let x=0;x<this.width;x++){arr.push(+isWhiteLike(this.getPointRGB(x,y)));}}
return arr.join('');}
print(){let str='';for(let y=0;y<this.height;y++){for(let x=0;x<this.width;x++){str+=+isWhiteLike(this.getPointRGB(x,y));}
str+='n';}
console.log(str);}}
function resizeImageData(imageData,width,height){let canvas1=document.createElement('canvas'),ctx1=canvas1.getContext('2d');let canvas2=document.createElement('canvas'),ctx2=canvas2.getContext('2d');let originWidth=imageData.width,originHeight=imageData.height;ctx1.putImageData(imageData,0,0);ctx2.scale(width/originWidth,height/originHeight);ctx2.drawImage(canvas1,0,0);return ctx2.getImageData(0,0,width,height);}
function getImageData(image){const width=image.width,height=image.height;let canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext("2d").drawImage(image,0,0,width,height);let imgData=canvas.getContext("2d").getImageData(0,0,width,height);return imgData;}
class Recognizer{constructor(){this.sampleData=[];}
addSampleData(char,sampleVal){this.sampleData.push({char,sampleVal});}
getSampleData(){return this.sampleData;}
matchSample(sampleVal){let matched={char:null,weight:0};for(let{char,sampleVal:_sampleVal}of this.sampleData){let weight=0;for(let i=0;i<sampleVal.length;i++){sampleVal[i]===_sampleVal[i]&&weight++;}
if(matched.weight<weight){matched.char=char;matched.weight=weight;}}
return matched.char;}}
// Loaded by the test process AND its Tesseract worker threads.
// Any attempt to download models or send an image fails the offline test.
for(const protocol of ['node:http','node:https'])for(const method of ['request','get'])require(protocol)[method]=()=>{throw new Error('Network disabled during offline OCR verification')};
global.fetch=()=>Promise.reject(new Error('Network disabled during offline OCR verification'));

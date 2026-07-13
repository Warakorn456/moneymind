const { withPodfile } = require('@expo/config-plugins');

// GoogleSignIn -> Firebase AppCheckCore ดึง GoogleUtilities/RecaptchaInterop มาแบบ transitive
// ซึ่งไม่ได้อยู่ใน whitelist ของ Expo autolinking ที่เปิด modular headers ให้อัตโนมัติ (static lib build)
// ทำให้ `pod install` fail ต้องเปิด use_modular_headers! แบบ global เอง (ตามที่ error ของ CocoaPods แนะนำ)
module.exports = function withPodfileModularHeaders(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('use_modular_headers!')) {
      config.modResults.contents = contents.replace(
        /(platform :ios,[^\n]*\n)/,
        `$1use_modular_headers!\n`
      );
    }
    return config;
  });
};

/**
 * A small built-in blocklist of the most commonly-used / breached passwords.
 * Intentionally lowercase (comparisons are case-insensitive). Not exhaustive —
 * for real coverage enable `password.policy.checkBreached` (HIBP) and/or supply
 * your own `password.policy.blocklist`.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
    'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
    '123456', '1234567', '12345678', '123456789', '1234567890', '12345', '123123', '111111', '000000',
    'qwerty', 'qwerty123', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1q2w3e4r', '1qaz2wsx', 'qazwsx',
    'abc123', 'a1b2c3', 'letmein', 'welcome', 'welcome1', 'admin', 'admin123', 'administrator',
    'root', 'toor', 'user', 'guest', 'test', 'test123', 'changeme', 'default', 'secret',
    'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'superman',
    'batman', 'master', 'shadow', 'michael', 'jordan', 'harley', 'trustno1', 'hello', 'hello123',
    'login', 'starwars', 'whatever', 'freedom', 'ninja', 'azerty', 'access', 'flower', 'hottie',
    'loveme', 'zaq12wsx', 'password!', 'passw0rd!', 'qwe123', 'asd123', 'aa123456', 'abcd1234',
    'iloveyou1', 'summer', 'winter', 'spring', 'autumn', 'money', 'love', 'god', 'sex',
]);

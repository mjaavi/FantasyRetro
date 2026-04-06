"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var InitialPricingService_1 = require("./src/application/services/economy/InitialPricingService");
var s = new InitialPricingService_1.InitialPricingService();
console.log('Griezmann 84 DL:', s.calculate({ ovr: 84, position: 'DL' }));
console.log('Jese 80 DL:', s.calculate({ ovr: 80, position: 'DL' }));
console.log('Ryan 78 PT:', s.calculate({ ovr: 78, position: 'PT' }));
console.log('Modric 85 MC:', s.calculate({ ovr: 85, position: 'MC' }));
console.log('Zaldua 74 DF:', s.calculate({ ovr: 74, position: 'DF' }));

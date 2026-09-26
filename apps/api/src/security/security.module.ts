import { Global, Module } from '@nestjs/common';
import { TokenVerifier, JwtTokenVerifier } from './token-verifier';
@Global()
@Module({
  providers: [{ provide: TokenVerifier, useClass: JwtTokenVerifier }],
  exports: [TokenVerifier],
})
export class SecurityModule {}

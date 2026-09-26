import { Injectable } from '@nestjs/common';
import { AutosError } from './autos-error';
export abstract class PaymentReferenceVerifier {
  abstract verify(reference: string): Promise<void>;
}
@Injectable()
export class LocalPaymentReferenceVerifier extends PaymentReferenceVerifier {
  async verify(reference: string): Promise<void> {
    if (process.env.NODE_ENV === 'production')
      throw new AutosError(
        503,
        'PAYMENT_NOT_AUTHORIZED',
        'Verificador externo de pagos no configurado.',
      );
    if (!reference.trim())
      throw new AutosError(
        400,
        'PAYMENT_REFERENCE_INVALID',
        'Referencia de pago vacía.',
      );
    // Solo boundary de desarrollo: no cobra ni autoriza dinero real.
  }
}

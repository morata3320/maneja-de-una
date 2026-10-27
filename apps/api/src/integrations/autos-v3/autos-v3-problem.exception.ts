import { HttpException } from '@nestjs/common';

export class AutosV3ProblemException extends HttpException {
  constructor(status: number, code: string, detail: string) {
    super(
      {
        type: `https://booking.epn.edu.ec/errors/${code.toLowerCase().replaceAll('_', '-')}`,
        title:
          status === 409 ? 'Vehículo No Disponible' : 'Entidad no procesable',
        status,
        code,
        detail,
      },
      status,
    );
  }
}

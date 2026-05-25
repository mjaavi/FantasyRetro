import { EmailOptions, IEmailService } from '../../domain/services/IEmailService';

export class FailoverEmailService implements IEmailService {
    constructor(private readonly providers: IEmailService[]) {}

    async sendEmail(options: EmailOptions): Promise<void> {
        const errors: string[] = [];

        for (const provider of this.providers) {
            try {
                await provider.sendEmail(options);
                return;
            } catch (error: any) {
                errors.push(`${provider.constructor.name}: ${error?.message ?? 'error desconocido'}`);
            }
        }

        throw new Error(errors.join(' | ') || 'No hay proveedores de correo configurados.');
    }
}

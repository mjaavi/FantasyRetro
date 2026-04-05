import { CronistaType, Picas } from '../../../../domain/models/scoring.models';
import { ICronistaStrategy, seleccionarPorProbabilidad } from './ICronistaStrategy';

export class CronistaPasional implements ICronistaStrategy {
    readonly tipo = CronistaType.PASIONAL;

    calcularPicas(base: number): Picas {
        if (base < 2) return seleccionarPorProbabilidad<Picas>([
            [0.80, Picas.NEG],
            [0.20, Picas.P1],
        ]);
        if (base < 5) return seleccionarPorProbabilidad<Picas>([
            [0.50, Picas.P1],
            [0.50, Picas.P2],
        ]);
        if (base < 8) return seleccionarPorProbabilidad<Picas>([
            [0.30, Picas.P2],
            [0.70, Picas.P3],
        ]);
        if (base < 11) return seleccionarPorProbabilidad<Picas>([
            [0.20, Picas.P3],
            [0.80, Picas.P4],
        ]);
        return Picas.P4;
    }
}

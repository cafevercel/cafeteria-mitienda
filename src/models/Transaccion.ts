export interface ITransaccion {
  id: string;
  producto: string;
  cantidad: number;
  precio: number;
  desde: string;
  hacia: string;
  fecha: Date;
}
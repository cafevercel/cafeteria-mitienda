import mongoose from 'mongoose';

export interface IProducto {
  _id?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  foto?: string;
}

const productoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  cantidad: { type: Number, required: true },
  foto: { type: String }
}, { timestamps: true });

const Producto = mongoose.models.Producto || mongoose.model('Producto', productoSchema);

export default Producto;
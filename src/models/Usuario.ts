import mongoose, { Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUsuario extends Document {
  _id: mongoose.Types.ObjectId;
  nombre: string;
  password: string;
  telefono?: string;
  rol: 'Almacen' | 'Vendedor';
  productos?: Array<{ producto: mongoose.Types.ObjectId; cantidad: number; precio: number }>;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telefono: { type: String },
  rol: { type: String, enum: ['Almacen', 'Vendedor'], required: true },
  productos: [{
    producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
    cantidad: { type: Number, default: 0 },
    precio: { type: Number, default: 0 }
  }]
}, { timestamps: true });

usuarioSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

usuarioSchema.methods.comparePassword = function(this: IUsuario, candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const Usuario = mongoose.models.Usuario || mongoose.model<IUsuario>('Usuario', usuarioSchema);

export default Usuario;
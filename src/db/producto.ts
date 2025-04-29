import { query } from '@/lib/db';
import { IProducto } from '@/models/Producto';

export async function createProducto(producto: Partial<IProducto>): Promise<IProducto> {
  const { nombre, precio, cantidad, foto } = producto;
  const result = await query(
    'INSERT INTO productos (nombre, precio, cantidad, foto) VALUES ($1, $2, $3, $4) RETURNING *',
    [nombre, precio, cantidad, foto]
  );
  return result.rows[0];
}

export async function findProductoById(id: string): Promise<IProducto | null> {
  const result = await query('SELECT * FROM productos WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function updateProducto(id: string, producto: Partial<IProducto>): Promise<IProducto | null> {
  const { nombre, precio, cantidad, foto } = producto;
  const result = await query(
    'UPDATE productos SET nombre = $1, precio = $2, cantidad = $3, foto = $4 WHERE id = $5 RETURNING *',
    [nombre, precio, cantidad, foto, id]
  );
  return result.rows[0] || null;
}

export async function deleteProducto(id: string): Promise<boolean> {
    const result = await query('DELETE FROM productos WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

export async function getAllProductos(): Promise<IProducto[]> {
  const result = await query('SELECT * FROM productos');
  return result.rows;
}
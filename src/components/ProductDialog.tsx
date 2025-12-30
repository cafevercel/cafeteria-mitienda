import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Image from 'next/image';
import { toast } from "@/hooks/use-toast";
import { Producto, Vendedor, Parametro } from '@/types';
import { Plus, Minus } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { formatearPorcentajeGanancia } from "@/lib/formatters";

type DeliveryStep = 'location' | 'quantities';
// type DeliveryLocation = 'cafeteria' | 'cocina'; // Removed in favor of user selection


interface ProductDialogProps {
  product: Producto;
  onClose: () => void;
  vendedores: Vendedor[];
  onEdit: (product: Producto, imageUrl: string | undefined) => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
  onDeliver: (
    productId: string,
    cantidadTotal: number,
    parametros: Array<{ nombre: string; cantidad: number }> | undefined,
    userId?: number
  ) => Promise<void>;
  seccionesExistentes: string[];
}

// Componente de autocompletado para secciones - MOVIDO FUERA
const SeccionAutocomplete = React.memo(({
  value,
  onChange,
  seccionesExistentes,
  placeholder = "Sección del producto"
}: {
  value: string;
  onChange: (value: string) => void;
  seccionesExistentes: string[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSecciones, setFilteredSecciones] = useState<string[]>([]);

  useEffect(() => {
    if (value) {
      const filtered = seccionesExistentes.filter(seccion =>
        seccion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSecciones(filtered);
    } else {
      setFilteredSecciones(seccionesExistentes);
    }
  }, [value, seccionesExistentes]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
      />

      {isOpen && (filteredSecciones.length > 0 || value) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {value && !seccionesExistentes.includes(value) && (
            <div
              className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b text-blue-600"
              onClick={() => {
                onChange(value);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">Crear nueva: &quot;{value}&quot;</span>
            </div>
          )}

          {filteredSecciones.map((seccion, index) => (
            <div
              key={index}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100"
              onClick={() => {
                onChange(seccion);
                setIsOpen(false);
              }}
            >
              {seccion}
            </div>
          ))}

          {filteredSecciones.length === 0 && value && seccionesExistentes.includes(value) && (
            <div className="px-3 py-2 text-gray-500">
              No hay más secciones que coincidan
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SeccionAutocomplete.displayName = 'SeccionAutocomplete';

type ModeType = 'view' | 'edit' | 'deliver';

// Componente de selección de ubicación - MOVIDO FUERA
// Componente de selección de ubicación - MOVIDO FUERA
const LocationSelectionMode = React.memo(({
  onVendorSelect,
  onBack,
  vendedores,
}: {
  onVendorSelect: (vendor: Vendedor) => void;
  onBack: () => void;
  vendedores: Vendedor[];
}) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Seleccionar vendedor para entrega</h3>

    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
      {vendedores.map((vendor) => (
        <Button
          key={vendor.id}
          variant="outline"
          className="w-full h-16 text-left flex items-center justify-start space-x-3 hover:bg-blue-50 hover:border-blue-300"
          onClick={() => onVendorSelect(vendor)}
        >
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <div>
            <div className="font-medium">{vendor.nombre}</div>
            <div className="text-sm text-gray-500">{vendor.rol}</div>
          </div>
        </Button>
      ))}

      {vendedores.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No hay vendedores disponibles
        </div>
      )}
    </div>

    <div className="flex justify-end">
      <Button variant="outline" onClick={onBack}>
        Cancelar
      </Button>
    </div>
  </div>
));

LocationSelectionMode.displayName = 'LocationSelectionMode';

// Subcomponente para el modo de edición - MOVIDO FUERA
const EditMode = React.memo(({
  editedProduct,
  imageUrl,
  mostrarPorcentajeGanancia,
  seccionesExistentes,
  onInputChange,
  onTieneParametrosChange,
  onMostrarPorcentajeGananciaChange,
  onParametroChange,
  onAddParametro,
  onRemoveParametro,
  onImageChange,
  onSave,
  onCancel,
}: {
  editedProduct: Producto;
  imageUrl: string;
  mostrarPorcentajeGanancia: boolean;
  seccionesExistentes: string[];
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTieneParametrosChange: (checked: boolean) => void;
  onMostrarPorcentajeGananciaChange: (checked: boolean) => void;
  onParametroChange: (index: number, field: 'nombre' | 'cantidad', value: string) => void;
  onAddParametro: () => void;
  onRemoveParametro: (index: number) => void;
  onImageChange: (url: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="space-y-4">
    <div>
      <Label>Nombre</Label>
      <Input
        name="nombre"
        value={editedProduct.nombre}
        onChange={onInputChange}
        placeholder="Nombre del producto"
      />
    </div>

    <div>
      <Label>Precio de venta</Label>
      <Input
        name="precio"
        type="number"
        value={editedProduct.precio}
        onChange={onInputChange}
        placeholder="Precio de venta"
      />
    </div>

    <div>
      <Label>Precio de compra</Label>
      <Input
        name="precio_compra"
        type="number"
        value={editedProduct.precio_compra || 0}
        onChange={onInputChange}
        placeholder="Precio de compra"
      />
    </div>

    <div>
      <Label>Sección</Label>
      <SeccionAutocomplete
        value={editedProduct.seccion || ''}
        onChange={(value) => {
          const event = {
            target: { name: 'seccion', value }
          } as React.ChangeEvent<HTMLInputElement>;
          onInputChange(event);
        }}
        seccionesExistentes={seccionesExistentes}
        placeholder="Sección del producto"
      />
    </div>

    <div className="flex items-center space-x-2">
      <Checkbox
        id="mostrarPorcentajeGanancia"
        checked={mostrarPorcentajeGanancia}
        onCheckedChange={(checked) => onMostrarPorcentajeGananciaChange(checked as boolean)}
      />
      <Label htmlFor="mostrarPorcentajeGanancia">Definir % de ganancia</Label>
    </div>

    {mostrarPorcentajeGanancia && (
      <div>
        <Label>% de ganancia</Label>
        <Input
          name="porcentajeGanancia"
          type="number"
          value={editedProduct.porcentajeGanancia || 0}
          onChange={onInputChange}
          placeholder="Porcentaje de ganancia"
          min="0"
          max="100"
        />
      </div>
    )}

    <div className="flex items-center space-x-2">
      <Checkbox
        id="tieneParametros"
        checked={editedProduct.tieneParametros}
        onCheckedChange={(checked) => onTieneParametrosChange(checked as boolean)}
      />
      <Label htmlFor="tieneParametros">Tiene parámetros</Label>
    </div>

    {editedProduct.tieneParametros ? (
      <div className="space-y-4">
        <Label>Parámetros</Label>
        {(editedProduct.parametros || []).map((param, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              value={param.nombre}
              onChange={(e) => onParametroChange(index, 'nombre', e.target.value)}
              placeholder="Nombre del parámetro"
              className="flex-1"
            />
            <Input
              type="number"
              value={param.cantidad}
              onChange={(e) => onParametroChange(index, 'cantidad', e.target.value)}
              placeholder="Cantidad"
              className="w-24"
            />
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onRemoveParametro(index)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={onAddParametro}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar parámetro
        </Button>
      </div>
    ) : (
      <div>
        <Label>Cantidad</Label>
        <Input
          name="cantidad"
          type="number"
          value={editedProduct.cantidad}
          onChange={onInputChange}
          placeholder="Cantidad"
        />
      </div>
    )}

    <div>
      <Label>Imagen del producto</Label>
      <ImageUpload
        value={imageUrl}
        onChange={onImageChange}
        disabled={false}
      />
    </div>

    <div className="flex justify-between gap-2 mt-4">
      <Button onClick={onSave} className="flex-1">Guardar cambios</Button>
      <Button variant="outline" onClick={onCancel} className="flex-1">
        Cancelar
      </Button>
    </div>
  </div>
));

EditMode.displayName = 'EditMode';

// Subcomponente para el modo de entrega - MOVIDO FUERA
const DeliverMode = React.memo(({
  product,
  parameterQuantities,
  simpleDeliveryQuantity,
  totalDeliveryQuantity,
  selectedVendor,
  onParameterQuantityChange,
  onSimpleDeliveryChange,
  onBack,
  onDeliver,
  getTotalCantidad,
}: {
  product: Producto;
  parameterQuantities: { [key: string]: number };
  simpleDeliveryQuantity: number;
  totalDeliveryQuantity: number;
  selectedVendor: Vendedor | null;
  onParameterQuantityChange: (paramName: string, value: number) => void;
  onSimpleDeliveryChange: (value: number) => void;
  onBack: () => void;
  onDeliver: () => void;
  getTotalCantidad: () => number;
}) => (
  <div className="space-y-4">
    {selectedVendor && (
      <div className="mb-4 p-3 bg-gray-50 rounded-md border">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="font-medium">
            Entregar a: {selectedVendor.nombre}
          </span>
        </div>
      </div>
    )}

    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Seleccionar cantidad a entregar</h3>

      {product.tiene_parametros && product.parametros ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Disponible total: {getTotalCantidad()}</p>

          {product.parametros.map((param) => (
            <div key={param.nombre} className="flex justify-between items-center">
              <span>{param.nombre} (Disponible: {param.cantidad})</span>
              <Input
                type="number"
                value={parameterQuantities[param.nombre] || 0}
                onChange={(e) => onParameterQuantityChange(param.nombre, parseInt(e.target.value) || 0)}
                className="w-20 ml-2"
                min={0}
                max={param.cantidad}
              />
            </div>
          ))}

          <div className="flex justify-between items-center font-semibold">
            <span>Total a entregar:</span>
            <span>{totalDeliveryQuantity}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Disponible: {product.cantidad}</p>
          <div className="flex justify-between items-center">
            <span>Cantidad:</span>
            <Input
              type="number"
              value={simpleDeliveryQuantity}
              onChange={(e) => onSimpleDeliveryChange(parseInt(e.target.value) || 0)}
              className="w-20 ml-2"
              min={0}
              max={product.cantidad}
            />
          </div>
        </div>
      )}
    </div>

    <div className="flex justify-between space-x-2 pt-4">
      <Button variant="outline" onClick={onBack}>
        Atrás
      </Button>
      <Button
        onClick={onDeliver}
        disabled={
          (product.tiene_parametros ? totalDeliveryQuantity === 0 : simpleDeliveryQuantity === 0) ||
          (product.tiene_parametros ? totalDeliveryQuantity > getTotalCantidad() : simpleDeliveryQuantity > product.cantidad)
        }
      >
        Confirmar Entrega
      </Button>
    </div>
  </div>
));

DeliverMode.displayName = 'DeliverMode';

// Subcomponente para el modo de visualización - MOVIDO FUERA
const ViewMode = React.memo(({
  product,
  mostrarPorcentajeGanancia,
  onEdit,
  onDeliver,
  onDelete,
  getTotalCantidad,
}: {
  product: Producto;
  mostrarPorcentajeGanancia: boolean;
  onEdit: () => void;
  onDeliver: () => void;
  onDelete: () => void;
  getTotalCantidad: () => number;
}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <p className="text-lg font-medium">Precio de venta: ${product.precio}</p>
      <p className="text-md text-gray-700">Precio de compra: ${product.precio_compra || 0}</p>
      {product.seccion && (
        <p className="text-md text-gray-700">Sección: {product.seccion}</p>
      )}
      {mostrarPorcentajeGanancia && (product.porcentajeGanancia ?? 0) > 0 && (
        <p className="text-md text-gray-700">
          % de ganancia: {formatearPorcentajeGanancia(product.porcentajeGanancia ?? 0, product.precio)}
        </p>
      )}

      {(product.tiene_parametros || product.tieneParametros) && product.parametros && product.parametros.length > 0 ? (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700">Parámetros:</h4>
          <div className="grid grid-cols-1 gap-2">
            {product.parametros.map((param, index) => (
              <div
                key={index}
                className="p-2 bg-gray-50 rounded-md flex justify-between items-center"
              >
                <span className="font-medium">{param.nombre}:</span>
                <span className="text-gray-600">{param.cantidad}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            Cantidad total: {getTotalCantidad()}
          </p>
        </div>
      ) : (
        <p className="text-gray-700">Cantidad disponible: {product.cantidad}</p>
      )}
    </div>

    <div className="flex justify-between gap-2">
      <Button onClick={onEdit} className="w-full">Editar</Button>
      <Button onClick={onDeliver} className="w-full">Entregar</Button>
      <Button onClick={onDelete} variant="destructive" className="w-full">
        Eliminar
      </Button>
    </div>
  </div>
));

ViewMode.displayName = 'ViewMode';

export default function ProductDialog({
  product,
  onClose,
  vendedores,
  onEdit,
  onDelete,
  onDeliver,
  seccionesExistentes,
}: ProductDialogProps) {
  const [mode, setMode] = useState<ModeType>('view');
  const [imageUrl, setImageUrl] = useState<string>(product.foto || '');
  const [editedProduct, setEditedProduct] = useState<Producto>({
    ...product,
    tieneParametros: product.tiene_parametros,
    tiene_parametros: product.tiene_parametros,
    parametros: product.parametros || [],
    foto: product.foto || '',
    precio_compra: product.precio_compra || 0,
    porcentajeGanancia: product.porcentajeGanancia || 0,
  });

  const [mostrarPorcentajeGanancia, setMostrarPorcentajeGanancia] = useState<boolean>(
    !!product.porcentajeGanancia
  );

  const [parameterQuantities, setParameterQuantities] = useState<{ [key: string]: number }>({});
  const [totalDeliveryQuantity, setTotalDeliveryQuantity] = useState(0);
  const [simpleDeliveryQuantity, setSimpleDeliveryQuantity] = useState<number>(0);
  const [selectedVendor, setSelectedVendor] = useState<Vendedor | null>(null);
  const [deliveryStep, setDeliveryStep] = useState<DeliveryStep>('location');

  // Efecto para sincronizar el estado con el producto recibido
  useEffect(() => {
    const tienePorcentajeGanancia = product.porcentajeGanancia !== undefined && product.porcentajeGanancia > 0;

    setEditedProduct({
      ...product,
      tieneParametros: product.tiene_parametros,
      tiene_parametros: product.tiene_parametros,
      parametros: product.parametros || [],
      foto: product.foto || '',
      precio_compra: product.precio_compra || 0,
      porcentajeGanancia: product.porcentajeGanancia || 0,
      tiene_agrego: product.tiene_agrego || false,
      tiene_costo: product.tiene_costo || false,
      agregos: product.agregos || [],
      costos: product.costos || [],
    });
    setImageUrl(product.foto || '');
    setMostrarPorcentajeGanancia(tienePorcentajeGanancia);
  }, [product]);

  // Función para iniciar el modo de entrega
  const handleDeliverMode = useCallback(() => {
    setSelectedVendor(null);
    setDeliveryStep('location');
    setMode('deliver');
  }, []);

  // Función para seleccionar ubicación de entrega
  const handleVendorSelect = useCallback((vendor: Vendedor) => {
    setSelectedVendor(vendor);
    setDeliveryStep('quantities');
  }, []);

  const handleDelivery = async () => {
    if (!selectedVendor) {
      toast({
        title: "Error",
        description: "Debe seleccionar un lugar de entrega",
        variant: "destructive",
      });
      return;
    }

    const cantidadAEntregar = product.tiene_parametros ? totalDeliveryQuantity : simpleDeliveryQuantity;

    if (cantidadAEntregar === 0) {
      toast({
        title: "Advertencia",
        description: "Por favor ingrese las cantidades a entregar.",
        variant: "default",
      });
      return;
    }

    if (cantidadAEntregar > getTotalCantidad()) {
      toast({
        title: "Error",
        description: "La cantidad total excede el stock disponible.",
        variant: "destructive",
      });
      return;
    }

    try {
      const parametrosEntrega = product.tiene_parametros && product.parametros ?
        product.parametros.map((param) => ({
          nombre: param.nombre,
          cantidad: parameterQuantities[param.nombre] || 0,
        })) :
        [];

      await onDeliver(
        product.id,
        cantidadAEntregar,
        parametrosEntrega.length > 0 ? parametrosEntrega : undefined,
        Number(selectedVendor.id)
      );

      toast({
        title: "Éxito",
        description: `Productos entregados a ${selectedVendor.nombre}`,
      });
      onClose();
    } catch (error) {
      console.error('Error delivering product:', error);
      toast({
        title: "Error",
        description: "No se pudieron entregar los productos",
        variant: "destructive",
      });
    }
  };

  const resetDeliveryState = useCallback(() => {
    setDeliveryStep('location');
    setSelectedVendor(null);
    setParameterQuantities({});
    setSimpleDeliveryQuantity(0);
  }, []);

  // Función para calcular la cantidad total disponible
  const getTotalCantidad = useCallback(() => {
    if ((product.tiene_parametros || product.tieneParametros) && product.parametros) {
      return product.parametros.reduce((sum, param) => sum + param.cantidad, 0);
    }
    return product.cantidad;
  }, [product]);

  // Manejo de cambios en los parámetros
  const handleParameterQuantityChange = useCallback((paramName: string, value: number) => {
    setParameterQuantities(prev => {
      const newQuantities = {
        ...prev,
        [paramName]: value,
      };
      setTotalDeliveryQuantity(Object.values(newQuantities).reduce((sum, qty) => sum + qty, 0));
      return newQuantities;
    });
  }, []);

  // Manejo de cambios en los inputs del formulario
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedProduct((prev) => ({
      ...prev,
      [name]: name === 'precio' || name === 'precio_compra' || name === 'cantidad' || name === 'porcentajeGanancia'
        ? Number(value)
        : value,
    }));
  }, []);

  // Manejo de cambios en los parámetros del producto
  const handleParametroChange = useCallback((index: number, field: 'nombre' | 'cantidad', value: string) => {
    setEditedProduct((prev) => {
      const newParametros = [...(prev.parametros || [])];
      newParametros[index] = {
        ...newParametros[index],
        [field]: field === 'cantidad' ? Number(value) : value,
      };
      return {
        ...prev,
        parametros: newParametros,
      };
    });
  }, []);

  // Agregar un nuevo parámetro
  const addParametro = useCallback(() => {
    setEditedProduct((prev) => ({
      ...prev,
      parametros: [...(prev.parametros || []), { nombre: '', cantidad: 0 }],
    }));
  }, []);

  // Eliminar un parámetro
  const removeParametro = useCallback((index: number) => {
    setEditedProduct((prev) => ({
      ...prev,
      parametros: prev.parametros?.filter((_, i) => i !== index),
    }));
  }, []);

  // Manejo del cambio en la propiedad "tieneParametros"
  const handleTieneParametrosChange = useCallback((checked: boolean) => {
    setEditedProduct((prev) => ({
      ...prev,
      tieneParametros: checked,
      tiene_parametros: checked,
      parametros: checked ? (prev.parametros?.length ? prev.parametros : [{ nombre: '', cantidad: 0 }]) : [],
    }));
  }, []);

  // Manejo del cambio en mostrar porcentaje de ganancia
  const handleMostrarPorcentajeGananciaChange = useCallback((checked: boolean) => {
    setMostrarPorcentajeGanancia(checked);
    setEditedProduct(prev => ({
      ...prev,
      porcentajeGanancia: checked ? (prev.porcentajeGanancia || 0) : 0
    }));
  }, []);

  // Guardar cambios en el producto
  const handleEdit = useCallback(async () => {
    try {
      if (imageUrl !== product.foto && !imageUrl) {
        toast({
          title: "Advertencia",
          description: "Espera a que la imagen se suba completamente.",
          variant: "default",
        });
        return;
      }

      const updatedProduct: Producto = {
        ...editedProduct,
        foto: imageUrl || product.foto,
        tiene_parametros: editedProduct.tieneParametros || false,
        tieneParametros: editedProduct.tieneParametros || false,
        parametros: editedProduct.tieneParametros ? editedProduct.parametros : [],
        precio_compra: editedProduct.precio_compra || 0,
        porcentajeGanancia: mostrarPorcentajeGanancia ? (editedProduct.porcentajeGanancia || 0) : 0,
        tiene_agrego: editedProduct.tiene_agrego || false,
        tiene_costo: editedProduct.tiene_costo || false,
        agregos: editedProduct.agregos || [],
        costos: editedProduct.costos || [],
      };

      console.log('Producto a guardar:', updatedProduct);
      await onEdit(updatedProduct, imageUrl !== product.foto ? imageUrl : undefined);
      setMode('view');
      toast({
        title: "Éxito",
        description: "Producto actualizado correctamente.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error en handleEdit:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el producto.",
        variant: "destructive",
      });
    }
  }, [editedProduct, imageUrl, product.foto, mostrarPorcentajeGanancia, onEdit]);

  // Manejo de la entrega del producto
  const handleDeliver = useCallback(async () => {
    if (!selectedVendor) {
      toast({
        title: "Error",
        description: "Debe seleccionar un lugar de entrega",
        variant: "destructive",
      });
      return;
    }

    const cantidadAEntregar = product.tiene_parametros ? totalDeliveryQuantity : simpleDeliveryQuantity;

    if (cantidadAEntregar === 0) {
      toast({
        title: "Advertencia",
        description: "Por favor ingrese las cantidades a entregar.",
        variant: "default",
      });
      return;
    }

    if (cantidadAEntregar > getTotalCantidad()) {
      toast({
        title: "Error",
        description: "La cantidad total excede el stock disponible.",
        variant: "destructive",
      });
      return;
    }

    try {
      const parametrosEntrega = product.tiene_parametros && product.parametros ?
        product.parametros.map((param) => ({
          nombre: param.nombre,
          cantidad: parameterQuantities[param.nombre] || 0,
        })) :
        [];

      await onDeliver(
        product.id,
        cantidadAEntregar,
        parametrosEntrega,
        Number(selectedVendor.id)
      );

      toast({
        title: "Éxito",
        description: `Producto entregado a ${selectedVendor.nombre} correctamente`,
      });

      onClose();
    } catch (error) {
      console.error('Error en entrega:', error);
      toast({
        title: "Error",
        description: "Error al entregar el producto",
        variant: "destructive",
      });
    }
  }, [selectedVendor, product, totalDeliveryQuantity, simpleDeliveryQuantity, getTotalCantidad, parameterQuantities, onDeliver, onClose]);

  // Función para eliminar producto
  const handleDelete = useCallback(async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      try {
        await onDelete(product.id);
        onClose();
        toast({
          title: "Éxito",
          description: "Producto eliminado correctamente.",
          variant: "default",
        });
      } catch (error) {
        console.error('Error al eliminar producto:', error);
        toast({
          title: "Error",
          description: "Error al eliminar el producto.",
          variant: "destructive",
        });
      }
    }
  }, [onDelete, product.id, onClose]);

  // Callbacks memoizados para los subcomponentes
  const handleSetMode = useCallback((newMode: ModeType) => {
    setMode(newMode);
  }, []);

  const handleSetDeliveryStep = useCallback((step: DeliveryStep) => {
    setDeliveryStep(step);
  }, []);

  const handleSimpleDeliveryChange = useCallback((value: number) => {
    setSimpleDeliveryQuantity(value);
  }, []);

  const handleImageChange = useCallback((url: string) => {
    setImageUrl(url);
  }, []);

  // Renderizado principal del componente
  // Renderizado principal del componente
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.nombre}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center">
            <Image
              src={imageUrl || '/placeholder.svg'}
              alt={product.nombre}
              width={200}
              height={200}
              className="object-cover rounded"
            />
          </div>

          {mode === 'edit' ? (
            <EditMode
              editedProduct={editedProduct}
              imageUrl={imageUrl}
              mostrarPorcentajeGanancia={mostrarPorcentajeGanancia}
              seccionesExistentes={seccionesExistentes}
              onInputChange={handleInputChange}
              onTieneParametrosChange={handleTieneParametrosChange}
              onMostrarPorcentajeGananciaChange={handleMostrarPorcentajeGananciaChange}
              onParametroChange={handleParametroChange}
              onAddParametro={addParametro}
              onRemoveParametro={removeParametro}
              onImageChange={handleImageChange}
              onSave={handleEdit}
              onCancel={() => handleSetMode('view')}
            />
          ) : mode === 'deliver' && deliveryStep === 'location' ? (
            <LocationSelectionMode
              onVendorSelect={handleVendorSelect}
              onBack={() => handleSetMode('view')}
              vendedores={vendedores}
            />
          ) : mode === 'deliver' && deliveryStep === 'quantities' ? (
            <DeliverMode
              product={product}
              parameterQuantities={parameterQuantities}
              simpleDeliveryQuantity={simpleDeliveryQuantity}
              totalDeliveryQuantity={totalDeliveryQuantity}
              selectedVendor={selectedVendor}
              onParameterQuantityChange={handleParameterQuantityChange}
              onSimpleDeliveryChange={handleSimpleDeliveryChange}
              onBack={() => handleSetDeliveryStep('location')}
              onDeliver={handleDeliver}
              getTotalCantidad={getTotalCantidad}
            />
          ) : (
            <ViewMode
              product={product}
              mostrarPorcentajeGanancia={mostrarPorcentajeGanancia}
              onEdit={() => handleSetMode('edit')}
              onDeliver={handleDeliverMode}
              onDelete={handleDelete}
              getTotalCantidad={getTotalCantidad}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


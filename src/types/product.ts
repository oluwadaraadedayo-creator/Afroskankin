export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface CartItem extends Product {
  quantity: number;
}

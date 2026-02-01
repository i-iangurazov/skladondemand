export type ReviewCardModel = {
  id: string;
  author: string;
  body: string;
  rating: number;
  createdAt?: string | null;
  avatarUrl?: string | null;
  product?: { handle: string; title: string } | null;
};

export type ProductReviewItem = {
  id: string;
  rating: number;
  title?: string | null;
  body: string;
  author?: string | null;
  createdAt?: string | null;
  avatarUrl?: string | null;
};

export type ProductReviewsResult = {
  averageRating: number | null;
  ratingCount: number | null;
  items: ProductReviewItem[];
};

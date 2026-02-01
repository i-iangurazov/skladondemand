export const COLLECTIONS_QUERY = `#graphql
  query Collections(
    $first: Int!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  )
    @inContext(country: $country, language: $language) {
    collections(first: $first, sortKey: UPDATED_AT) {
      nodes {
        id
        handle
        title
        description
        image {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
      }
    }
  }
`;

export const COLLECTIONS_PAGINATED_QUERY = `#graphql
  query CollectionsPaginated(
    $first: Int!
    $after: String
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    collections(first: $first, after: $after, sortKey: TITLE) {
      nodes {
        id
        handle
        title
        description
        image {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const COLLECTION_INFO_QUERY = `#graphql
  query CollectionInfo(
    $handle: String!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  )
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: $handle) {
      id
      handle
      title
      description
      image {
        url(transform: { maxWidth: $imageWidth })
        altText
      }
    }
  }
`;

export const COLLECTION_COLORS_QUERY = `#graphql
  query CollectionColors(
    $handle: String!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    collectionByHandle(handle: $handle) {
      colors: metafield(namespace: "custom", key: "colors") {
        value
      }
      colorOptions: metafield(namespace: "custom", key: "color_options") {
        value
      }
      colorsList: metafield(namespace: "custom", key: "colors_list") {
        value
      }
      colours: metafield(namespace: "custom", key: "colours") {
        value
      }
    }
  }
`;

export const COLLECTION_BY_HANDLE_QUERY = `#graphql
  query CollectionByHandle(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  )
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: $handle) {
      id
      handle
      title
      description
      image {
        url(transform: { maxWidth: $imageWidth })
        altText
      }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        nodes {
          id
          handle
          title
          availableForSale
          featuredImage {
            url(transform: { maxWidth: $imageWidth })
            altText
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          vendor
          tags
          options {
            name
            values
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_PAGE_QUERY = `#graphql
  query CollectionProductsPage(
    $handle: String!
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  )
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: $handle) {
      products(
        first: $first
        after: $after
        last: $last
        before: $before
        filters: $filters
        sortKey: $sortKey
        reverse: $reverse
      ) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
            id
            handle
            title
            vendor
            availableForSale
            featuredImage {
              url(transform: { maxWidth: $imageWidth })
              altText
              width
              height
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
            options {
              name
              values
            }
            tags
          }
        }
      }
    }
  }
`;

export const FEATURED_PRODUCTS_QUERY = `#graphql
  query FeaturedProducts(
    $first: Int!
    $query: String!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  )
    @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: CREATED_AT, reverse: true, query: $query) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        vendor
        tags
        options {
          name
          values
        }
      }
    }
  }
`;

export const LATEST_PRODUCTS_QUERY = `#graphql
  query LatestProducts($first: Int!, $imageWidth: Int!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        vendor
        tags
        options {
          name
          values
        }
      }
    }
  }
`;

export const FEATURED_PRODUCTS_PAGE_QUERY = `#graphql
  query FeaturedProductsPage(
    $first: Int!
    $after: String
    $query: String!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: $query) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        vendor
        tags
        options {
          name
          values
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const LATEST_PRODUCTS_PAGE_QUERY = `#graphql
  query LatestProductsPage(
    $first: Int!
    $after: String
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        vendor
        tags
        options {
          name
          values
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const PRODUCTS_PAGINATED_QUERY = `#graphql
  query ProductsPaginated(
    $first: Int!
    $after: String
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, after: $after, sortKey: TITLE) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        vendor
        tags
        options {
          name
          values
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const ALL_PRODUCTS_PAGE_QUERY = PRODUCTS_PAGINATED_QUERY;

export const SEARCH_PRODUCTS_PAGE_QUERY = `#graphql
  query SearchProductsPage(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $query: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first
      after: $after
      last: $last
      before: $before
      query: $query
      sortKey: $sortKey
      reverse: $reverse
    ) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          id
          handle
          title
          vendor
          availableForSale
          featuredImage {
            url(transform: { maxWidth: $imageWidth })
            altText
            width
            height
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          options {
            name
            values
          }
          tags
        }
      }
    }
  }
`;

export const SEARCH_SUGGESTIONS_QUERY = `#graphql
  query SearchSuggestions(
    $query: String!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: 5, query: $query) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
    collections(first: 5, query: $query) {
      nodes {
        id
        handle
        title
        image {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
      }
    }
  }
`;
export const PRODUCT_BY_HANDLE_QUERY = `#graphql
  query ProductByHandle(
    $handle: String!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  )
    @inContext(country: $country, language: $language) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      descriptionHtml
      featuredImage {
        url(transform: { maxWidth: $imageWidth })
        altText
      }
      images(first: 12) {
        nodes {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
      }
      options {
        name
        values
      }
      variants(first: 60) {
        nodes {
          id
          title
          availableForSale
          selectedOptions {
            name
            value
          }
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
        }
      }
      tags
      vendor
      productType
    }
  }
`;

export const PRODUCTS_BY_HANDLES_QUERY = `#graphql
  query ProductsByHandles(
    $query: String!
    $first: Int!
    $imageWidth: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, query: $query) {
      nodes {
        id
        handle
        title
        availableForSale
        featuredImage {
          url(transform: { maxWidth: $imageWidth })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        vendor
        tags
        options {
          name
          values
        }
      }
    }
  }
`;

export const MENU_QUERY = `#graphql
  query Menu($handle: String!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    menu(handle: $handle) {
      items {
        title
        url
        items {
          title
          url
          items {
            title
            url
          }
        }
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_COUNT_QUERY = `#graphql
  query CollectionProductsCount($handle: String!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: $handle) {
      id
      handle
      productsCount
    }
  }
`;

export const PRODUCTS_COUNT_QUERY = `#graphql
  query ProductsCount(
    $query: String
    $first: Int!
    $after: String
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, after: $after, query: $query) {
      edges {
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_COUNT_SCAN_QUERY = `#graphql
  query CollectionProductsCountScan(
    $handle: String!
    $first: Int!
    $after: String
    $filters: [ProductFilter!]
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    collectionByHandle(handle: $handle) {
      products(first: $first, after: $after, filters: $filters) {
        edges {
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const CART_QUERY = `#graphql
  query Cart($id: ID!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    cart(id: $id) {
      id
      checkoutUrl
      totalQuantity
      cost {
        subtotalAmount {
          amount
          currencyCode
        }
        totalAmount {
          amount
          currencyCode
        }
        totalTaxAmount {
          amount
          currencyCode
        }
      }
      lines(first: 100) {
        nodes {
          id
          quantity
          cost {
            amountPerQuantity {
              amount
              currencyCode
            }
            totalAmount {
              amount
              currencyCode
            }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
              selectedOptions {
                name
                value
              }
              product {
                handle
                title
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const CART_CREATE_MUTATION = `#graphql
  mutation CartCreate($input: CartInput!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          nodes {
            id
            quantity
            cost {
              amountPerQuantity {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                product {
                  handle
                  title
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          nodes {
            id
            quantity
            cost {
              amountPerQuantity {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                product {
                  handle
                  title
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          nodes {
            id
            quantity
            cost {
              amountPerQuantity {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                product {
                  handle
                  title
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          nodes {
            id
            quantity
            cost {
              amountPerQuantity {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            merchandise {
              ... on ProductVariant {
                id
                title
                selectedOptions {
                  name
                  value
                }
                product {
                  handle
                  title
                  featuredImage {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const REVIEWS_METAOBJECTS_QUERY = `#graphql
  query ReviewsMetaobjects($query: String!, $first: Int!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    metaobjects(type: "product_review", first: $first, query: $query) {
      nodes {
        id
        fields {
          key
          value
          type
          reference {
            __typename
            ... on MediaImage {
              image {
                url
                altText
              }
            }
            ... on File {
              url
            }
            ... on Product {
              handle
              title
            }
          }
          references(first: 10) {
            nodes {
              __typename
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
              ... on File {
                url
              }
              ... on Product {
                handle
                title
              }
            }
          }
        }
      }
    }
  }
`;

export const REVIEWS_METAFIELDS_QUERY = `#graphql
  query ReviewsMetafields($handle: String!, $country: CountryCode!, $language: LanguageCode!)
    @inContext(country: $country, language: $language) {
    productByHandle(handle: $handle) {
      average: metafield(namespace: "reviews", key: "average_rating") {
        value
      }
      count: metafield(namespace: "reviews", key: "rating_count") {
        value
      }
      items: metafield(namespace: "reviews", key: "items") {
        value
      }
    }
  }
`;

export const LATEST_REVIEWS_METAOBJECTS_QUERY = `#graphql
  query LatestReviewsMetaobjects(
    $first: Int!
    $sortKey: MetaobjectSortKeys
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    metaobjects(type: "product_review", first: $first, sortKey: $sortKey) {
      nodes {
        id
        fields {
          key
          value
          reference {
            __typename
            ... on MediaImage {
              image {
                url
                altText
              }
            }
            ... on File {
              url
            }
            ... on Product {
              handle
              title
            }
          }
          references(first: 10) {
            nodes {
              __typename
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
              ... on File {
                url
              }
              ... on Product {
                handle
                title
              }
            }
          }
        }
      }
    }
  }
`;

export const LATEST_REVIEWS_METAOBJECTS_FALLBACK_QUERY = `#graphql
  query LatestReviewsMetaobjectsFallback(
    $first: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    metaobjects(type: "product_review", first: $first) {
      nodes {
        id
        fields {
          key
          value
          reference {
            __typename
            ... on MediaImage {
              image {
                url
                altText
              }
            }
            ... on File {
              url
            }
            ... on Product {
              handle
              title
            }
          }
          references(first: 10) {
            nodes {
              __typename
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
              ... on File {
                url
              }
              ... on Product {
                handle
                title
              }
            }
          }
        }
      }
    }
  }
`;

export const PRODUCTS_REVIEWS_METAFIELDS_QUERY = `#graphql
  query ProductsReviewsMetafields(
    $first: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        handle
        title
        items: metafield(namespace: "reviews", key: "items") {
          value
        }
      }
    }
  }
`;

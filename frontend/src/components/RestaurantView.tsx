interface RestaurantViewProps {
    restaurant_name: string | null
}

export function RestaurantView({ restaurant_name }: RestaurantViewProps) {
    return (
        <div className="main">
            <h1 className="restaurant-name">
                {restaurant_name ?? 'Restaurant Name'}
            </h1>
        </div>
    )
}

export default RestaurantView
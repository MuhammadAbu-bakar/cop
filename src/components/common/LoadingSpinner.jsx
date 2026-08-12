const LoadingSpinner = ({ size = "md", color = "blue" }) => {
  const sizes = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const colors = {
    blue: "border-blue-600",
    white: "border-white",
    gray: "border-gray-600",
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div
          className={`animate-spin rounded-full ${sizes[size]} border-b-2 ${colors[color]} mx-auto`}
        ></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;

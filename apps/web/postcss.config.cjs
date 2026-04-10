module.exports = {
  plugins: [
    require('postcss-import'),
    // CSS Nesting spec (not SASS nesting).
    require('tailwindcss/nesting')(require('postcss-nesting')),
    require('tailwindcss'),
    require('autoprefixer'),
    require('postcss-preset-env')({
      features: {
        'nesting-rules': false,
      },
    }),
  ],
};

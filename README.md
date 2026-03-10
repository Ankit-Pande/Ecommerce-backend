# 🛒 Ecommerce Backend API

Production-ready Ecommerce Backend built with **Node.js, TypeScript, Express, Prisma, PostgreSQL and Redis**.

This project demonstrates a **secure, scalable and modern backend architecture** designed for small-to-medium level production applications.

The backend supports **authentication, cart system, order management, payment integration, caching and admin management.**

---

## 🚀 Tech Stack

Backend is built using modern production technologies.

- Node.js
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL (Supabase)
- Redis
- Razorpay Payments
- Cloudinary Image Storage
- Twilio SMS Service

---

## 🔐 Security Features

This backend follows multiple security best practices.

- JWT Access Token + Refresh Token
- Secure HTTP-Only Cookies
- CSRF Protection
- Rate Limiting
- Helmet Security Headers
- CORS Protection
- OTP Authentication
- Role Based Access Control (RBAC)
- Session Revocation System
- Redis Token Blacklisting

---

## 📦 Core Features

### Authentication System
- OTP based login/signup
- Twilio SMS integration
- Secure JWT session management
- Refresh token rotation
- Session revoke support

### Product System
- Category & Subcategory management
- Product listing
- Trending products
- Discount offers
- Product slug routing
- Product search & filtering

### Cart System
- Add product to cart
- Update quantity
- Remove items
- Redis cached cart
- Stock validation

### Order System
- Order creation
- Address management
- Atomic stock update
- Order history
- Admin order status management

### Payment Integration
- Razorpay payment gateway
- COD support
- Razorpay webhook verification
- Payment status tracking

### Admin Panel APIs
- Create categories
- Create products
- Manage offers
- Hide products
- Manage banners
- Update order status

---

## ⚡ Performance Features

- Redis caching for frequently used data
- Efficient Prisma queries
- Pagination system
- Optimized API responses

---

## 📂 Backend Architecture

Project follows clean and modular architecture.

src  
config  
controllers  
services  
middlewares  
utils  
validation  
routes  
integrations  
types  

This architecture separates controllers, services, validation and middleware to keep the project scalable and maintainable.

---

## ⚙️ Installation

Clone the repository

git clone https://github.com/yourusername/Ecommerce-backend.git

Go to project folder

cd Ecommerce-backend

Install dependencies

npm install

---

## ▶️ Run Server

Development mode

npm run dev

Production mode

npm run build  
npm start

---

## 🌍 Deployment

Backend can be deployed on:

- DigitalOcean
- Render
- Railway

Database:

PostgreSQL (Supabase)

---

## 🧪 API Testing

APIs can be tested using:

- Postman
- Thunder Client
- REST Client

---

## 👨‍💻 Author

Ankit  
Backend Developer focused on Node.js, TypeScript and scalable API architecture
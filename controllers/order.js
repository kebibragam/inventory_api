const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const { mongoose } = require("mongoose");

const getAllOrders = async (req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json(orders);
};
const getSingleOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id });
  if (!order) {
    throw new CustomError.NotFoundError(`No order with id : ${req.params.id}`);
  }
  res.status(StatusCodes.OK).json(order);
};
const createOrder = async (req, res) => {
  try {
    // console.log(req.body);
    const { items: cartItems } = req.body;
    if (!cartItems || cartItems.length < 1) {
      throw new CustomError.BadRequestError("No cart items provided");
    }
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // console.log(req.body);
      const { items: cartItems } = req.body;
      if (!cartItems || cartItems.length < 1) {
        throw new CustomError.BadRequestError("No cart items provided");
      }
      let orderItems = [];
      let total = 0;
      let profitAmount = 0;
      for (const item of cartItems) {
        const dbProduct = await Product.findOne({
          _id: item.productId,
        }).session(session);
        if (!dbProduct) {
          throw new CustomError.NotFoundError(
            `No product with id : ${item.productId}`
          );
        }

        // console.log(dbProduct);
        const { name, sellingPrice, image, profit, _id, quantity } = dbProduct;
        if (dbProduct.quantity < item.amount) {
          return res.status(400).send("Not enough product in stock");
        }

        const singleOrderItem = {
          name,
          sellingPrice,
          profit,
          quantity: item.amount,
          productID: _id,
        };
        // add item to order
        orderItems = [...orderItems, singleOrderItem];
        //decrease quantity
        dbProduct.quantity -= item.amount;
        //increase soldQuantity
        dbProduct.soldQuantity += item.amount;

        await dbProduct.save();
        // calculate subtotal
        total += item.amount * sellingPrice;
        profitAmount += item.amount * profit;
      }
      const { name: customerName, _id: customerID } = await Customer.findOne({
        number: req.body.customerNumber,
      });

      const order = await Order.create({
        orderItems,
        total,
        profitAmount,
        customerName,
        customerNumber: req.body.customerNumber,
        customerID,
      });

      res.status(StatusCodes.CREATED).json({ order });
    });
    session.endSession();
  } catch (error) {
    console.log(error);
    res.status(500).send("something went wrong");
  }
};
module.exports = { getAllOrders, getSingleOrder, createOrder };

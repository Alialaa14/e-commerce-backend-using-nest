import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import {Socket} from "socket.io"
@WebSocketGateway()
export class OrderGatewayServices {
    constructor(){}

    // @SubscribeMessage("order:create")
    // handleOrderCreate(client:Socket,data:{orderId:string}){
    //     // first get full order summary 
    //     const order = 
    // }
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: 'version',
  optimisticConcurrency: true,
})
export class User {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: String, required: false })
  firstName?: string;

  @Prop({ type: String, required: false })
  lastName?: string;

  @Prop({ type: String, required: false })
  phoneNumber?: string;

  @Prop({ type: Date, required: false })
  dateOfBirth?: Date;

  @Prop({ type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' })
  status: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({ type: Object, default: {} })
  profile: Record<string, any>;

  @Prop({ type: Date, required: false })
  lastLoginAt?: Date;

  @Prop({ type: Date, required: false })
  emailVerifiedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  @Prop({ type: Number, default: 0 })
  version: number;

  // Domain Events (stored for event sourcing if needed)
  @Prop({ type: [Object], default: [] })
  domainEvents: Array<{
    eventType: string;
    eventData: Record<string, any>;
    occurredAt: Date;
  }>;

  // Soft delete
  @Prop({ type: Date, required: false })
  deletedAt?: Date;

  // Audit fields
  @Prop({ type: String, required: false })
  createdBy?: string;

  @Prop({ type: String, required: false })
  updatedBy?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for better query performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userId: 1 }, { unique: true });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ deletedAt: 1 }, { sparse: true });

// Compound indexes
UserSchema.index({ email: 1, status: 1 });
UserSchema.index({ userId: 1, status: 1 });

// Enable sharding on userId (for MongoDB sharded cluster)
UserSchema.index({ userId: 'hashed' }); // Hashed sharding for even distribution

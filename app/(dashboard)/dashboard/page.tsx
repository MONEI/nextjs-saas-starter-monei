'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
  cancelSubscriptionAction,
  updatePaymentMethodAction,
  changePlanAction,
} from '@/lib/payments/actions';
import { useActionState } from 'react';
import { TeamDataWithMembers, User } from '@/lib/db/schema';
import { removeTeamMember, inviteTeamMember } from '@/app/(login)/actions';
import useSWR from 'swr';
import { Suspense, useState } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  PlusCircle,
  CreditCard,
  ArrowRightLeft,
  XCircle,
  Check,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

type ActionState = {
  error?: string;
  success?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── Subscription Management Portal ────────────────────────────────────────

function SubscriptionSkeleton() {
  return (
    <Card className="mb-8 h-[200px]">
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-gray-200 rounded"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="flex gap-2">
            <div className="h-9 w-36 bg-gray-200 rounded"></div>
            <div className="h-9 w-36 bg-gray-200 rounded"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManageSubscription() {
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isActive = teamData?.subscriptionStatus === 'active';
  const isTrialing = teamData?.subscriptionStatus === 'trialing';
  const hasSubscription = isActive || isTrialing;
  const currentPlan = teamData?.planName || 'Free';
  const alternatePlan = currentPlan === 'Plus' ? 'base' : 'plus';
  const alternatePlanName = currentPlan === 'Plus' ? 'Base' : 'Plus';

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-500" />
          Subscription
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Current plan info */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-lg font-semibold">{currentPlan} Plan</p>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? 'Active — billed monthly via MONEI'
                  : isTrialing
                  ? 'Trial period — no charge yet'
                  : 'No active subscription'}
              </p>
            </div>
            {!hasSubscription && (
              <Button asChild>
                <Link href="/pricing">Choose a Plan</Link>
              </Button>
            )}
          </div>

          {/* Management actions */}
          {hasSubscription && (
            <>
              <div className="border-t pt-4 flex flex-wrap gap-3">
                {/* Update payment method */}
                <form action={updatePaymentMethodAction}>
                  <Button type="submit" variant="outline" size="sm">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Update Payment Method
                  </Button>
                </form>

                {/* Change plan */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowChangePlan(!showChangePlan);
                    setShowCancelConfirm(false);
                  }}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Change Plan
                </Button>

                {/* Cancel */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setShowCancelConfirm(!showCancelConfirm);
                    setShowChangePlan(false);
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Subscription
                </Button>
              </div>

              {/* Change plan panel */}
              {showChangePlan && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm mb-3">
                    Switch from <strong>{currentPlan}</strong> to{' '}
                    <strong>{alternatePlanName}</strong>?
                    {alternatePlan === 'plus'
                      ? " You\u2019ll get early access to new features and 24/7 support."
                      : ' Your next billing cycle will reflect the lower rate.'}
                  </p>
                  <form action={changePlanAction} className="flex gap-2">
                    <input type="hidden" name="planId" value={alternatePlan} />
                    <Button type="submit" size="sm">
                      <Check className="mr-2 h-4 w-4" />
                      Switch to {alternatePlanName}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChangePlan(false)}
                    >
                      Cancel
                    </Button>
                  </form>
                </div>
              )}

              {/* Cancel confirmation panel */}
              {showCancelConfirm && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <p className="text-sm text-red-800 mb-3">
                    Are you sure? Your subscription will be cancelled immediately
                    and you'll lose access to {currentPlan} plan features.
                  </p>
                  <form action={cancelSubscriptionAction} className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                    >
                      Yes, Cancel My Subscription
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      Keep Subscription
                    </Button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
      {hasSubscription && (
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Payments processed securely by MONEI. Cards, Bizum, PayPal, Apple Pay & Google Pay accepted.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

// ─── Team Members ───────────────────────────────────────────────────────────

function TeamMembersSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="flex items-center space-x-4">
            <div className="size-8 rounded-full bg-gray-200"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-3 w-14 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMembers() {
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMember, {});

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  if (!teamData?.teamMembers?.length) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No team members yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {teamData.teamMembers.map((member, index) => (
            <li key={member.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarFallback>
                    {getUserDisplayName(member.user)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {getUserDisplayName(member.user)}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {member.role}
                  </p>
                </div>
              </div>
              {index > 1 ? (
                <form action={removeAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={isRemovePending}
                  >
                    {isRemovePending ? 'Removing...' : 'Remove'}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {removeState?.error && (
          <p className="text-red-500 mt-4">{removeState.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Invite Team Member ─────────────────────────────────────────────────────

function InviteTeamMemberSkeleton() {
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InviteTeamMember() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const isOwner = user?.role === 'owner';
  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteTeamMember, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-2">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter email"
              required
              disabled={!isOwner}
            />
          </div>
          <div>
            <Label>Role</Label>
            <RadioGroup
              defaultValue="member"
              name="role"
              className="flex space-x-4"
              disabled={!isOwner}
            >
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member">Member</Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">Owner</Label>
              </div>
            </RadioGroup>
          </div>
          {inviteState?.error && (
            <p className="text-red-500">{inviteState.error}</p>
          )}
          {inviteState?.success && (
            <p className="text-green-500">{inviteState.success}</p>
          )}
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Invite Member
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            You must be a team owner to invite new members.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Team Settings</h1>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      <Suspense fallback={<TeamMembersSkeleton />}>
        <TeamMembers />
      </Suspense>
      <Suspense fallback={<InviteTeamMemberSkeleton />}>
        <InviteTeamMember />
      </Suspense>
    </section>
  );
}

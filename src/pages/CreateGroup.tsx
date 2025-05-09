import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createGroup, ensureAuthenticated } from "@/lib/firebase";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { displayToast } from "@/lib/utils";

export default function CreateGroup() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    defaultCurrency: "USD"
  });
  
  // State for managing additional members
  const [additionalMembers, setAdditionalMembers] = useState([]);
  const [newMember, setNewMember] = useState({
    walletAddress: "",
    name: ""
  });

  const handleAddMember = () => {
    if (!newMember.walletAddress.trim()) {
      displayToast("Missing Information", "Wallet address is required", "error");
      return;
    }
    
    // Check if wallet address already exists
    if (additionalMembers.some(member => member.walletAddress === newMember.walletAddress.trim())) {
      displayToast("Duplicate Member", "This wallet address is already added", "error");
      return;
    }
    
    setAdditionalMembers([
      ...additionalMembers,
      {
        walletAddress: newMember.walletAddress.trim(),
        name: newMember.name.trim() || "Unnamed Member"
      }
    ]);
    
    // Reset the new member form
    setNewMember({
      walletAddress: "",
      name: ""
    });
  };
  
  const handleRemoveMember = (index) => {
    const updatedMembers = [...additionalMembers];
    updatedMembers.splice(index, 1);
    setAdditionalMembers(updatedMembers);
  };

  const handleCreate = async () => {
    if (!user) return;
    
    try {
      setIsCreating(true);
      
      // Ensure we're authenticated
      await ensureAuthenticated(user.walletAddress);
      
      if (!formData.name.trim()) {
        throw new Error("Group name is required");
      }
      
      // Extract wallet addresses from additional members
      const memberAddresses = additionalMembers.map(member => member.walletAddress);
      
      // Add current user to members
      const members = [user.walletAddress];
      
      // Add unique additional members
      memberAddresses.forEach(address => {
        if (!members.includes(address)) {
          members.push(address);
        }
      });
      
      // Add member details for future reference
      const memberDetails = additionalMembers.reduce((acc, member) => {
        acc[member.walletAddress] = { name: member.name };
        return acc;
      }, {});
      
      // Add current user to memberDetails
      memberDetails[user.walletAddress] = { name: user.displayName || "You" };
      
      // Create the group
      const groupData = {
        name: formData.name,
        description: formData.description,
        creator: user.walletAddress,
        members,
        memberDetails,
        defaultCurrency: formData.defaultCurrency,
      };
      
      const newGroup = await createGroup(groupData);
      displayToast("Group Created", `${formData.name} has been created successfully!`, "success");
      navigate(`/groups/${newGroup.id}`);
    } catch (error) {
      console.error("Error creating group:", error);
      displayToast("Error Creating Group", error.message, "error");
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <Layout>
      <div className="container max-w-2xl py-6">
        <Button variant="outline" size="sm" className="mb-4" onClick={() => navigate("/groups")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Groups
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>Create New Group</CardTitle>
            <CardDescription>Set up a new expense sharing group</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                placeholder="Enter group name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a description for your group"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select
                value={formData.defaultCurrency}
                onValueChange={(value) => setFormData({ ...formData, defaultCurrency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="INR">INR (₹)</SelectItem>
                  <SelectItem value="ETH">ETH (Ξ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label>Members</Label>
                <p className="text-sm text-muted-foreground mb-2">You will automatically be added to the group</p>
              </div>
              
              {/* List of added members */}
              {additionalMembers.length > 0 && (
                <div className="space-y-2 border rounded-md p-3">
                  <p className="text-sm font-medium">Added Members ({additionalMembers.length})</p>
                  <div className="space-y-2">
                    {additionalMembers.map((member, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded-sm">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{member.walletAddress}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRemoveMember(index)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add new member form */}
              <div className="border rounded-md p-3">
                <p className="text-sm font-medium mb-3">Add New Member</p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="memberWallet">Wallet Address *</Label>
                    <Input
                      id="memberWallet"
                      placeholder="0x..."
                      value={newMember.walletAddress}
                      onChange={(e) => setNewMember({ ...newMember, walletAddress: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="memberName">Member Name</Label>
                    <Input
                      id="memberName"
                      placeholder="Enter name (optional)"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    />
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="w-full" 
                    onClick={handleAddMember}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/groups")}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Group"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}